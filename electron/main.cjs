const {app, BrowserWindow, Menu, protocol, net, ipcMain, dialog, shell, session} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {randomUUID} = require('node:crypto');
const {bundlePath, validatePDF, safeName, externalURL, atomicWrite, resolveImage, MAX_DOCUMENT_BYTES} = require('./files.cjs');
const {createDraftStore} = require('./draft-store.cjs');

app.setName('지면');
// Retain the original profile and app ID so existing documents survive rebranding.
const profile = app.commandLine.getSwitchValue('user-data-dir');
app.setPath('userData', profile ? path.resolve(profile) : path.join(app.getPath('appData'), 'ResumeEditor'));
protocol.registerSchemesAsPrivileged([{scheme: 'app', privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true}}]);

const APP_URL = 'app://editor/';
const prints = new Map();
let mainWindow, exporting = false;
const draftStore = createDraftStore(app.getPath('userData'));
let closeListener = false, closingToken = null, closeTimer, allowClose = false, quitRequested = false;
const csp = "default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data: https:; media-src 'self' data: blob: https: http:; connect-src 'self' data: blob: https: http:; frame-src https: http:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'";

function trusted(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || event.senderFrame.url !== APP_URL) {
    throw Error('편집기 창에서만 사용할 수 있는 기능입니다.');
  }
}
function command(value) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('editor:command', value); }
function openExternal(value) { const url = externalURL(value); if (url) shell.openExternal(url).catch(() => {}); }

async function renderPDF(job) {
  validatePDF(job);
  const token = randomUUID(); prints.set(token, job.html);
  // The print page's CSP blocks document scripts. JavaScript stays enabled only
  // so the main process can wait for fonts and images before printing.
  const win = new BrowserWindow({show: false, width: 1400, height: 1000, webPreferences: {sandbox: true, contextIsolation: true, nodeIntegration: false}});
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  try {
    await win.loadURL(`app://print/${token}`);
    await win.webContents.executeJavaScript(`Promise.race([Promise.all([document.fonts.ready,...Array.from(document.images, image => image.complete ? Promise.resolve() : new Promise(resolve => {image.onload=resolve;image.onerror=resolve}))]).then(()=>true),new Promise((_,reject)=>setTimeout(()=>reject(Error('이미지와 글꼴을 불러오는 시간이 초과되었습니다.')),25000))])`);
    return await win.webContents.printToPDF({pageSize: job.paper, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, scale: 1, margins: {top: 0, bottom: 0, left: 0, right: 0}});
  } finally { prints.delete(token); if (!win.isDestroyed()) win.destroy(); }
}

function handlers() {
  ipcMain.handle('editor:load-draft', event => { trusted(event); return draftStore.load(); });
  ipcMain.handle('editor:save-draft', (event, doc) => {
    trusted(event); return draftStore.save(doc);
  });
  ipcMain.handle('editor:save-file', async (event, file) => {
    trusted(event);
    if (!file || !(file.bytes instanceof Uint8Array) || file.bytes.byteLength > MAX_DOCUMENT_BYTES || !['application/json', 'text/markdown'].includes(file.type)) throw Error('저장할 문서를 확인해 주세요.');
    const extension = file.type === 'application/json' ? 'jimyeon' : 'md';
    const result = await dialog.showSaveDialog(mainWindow, {defaultPath: safeName(file.name), filters: [{name: extension === 'jimyeon' ? '지면 문서' : '마크다운', extensions: [extension]}]});
    if (result.canceled || !result.filePath) return false;
    await atomicWrite(result.filePath, file.bytes); return true;
  });
  ipcMain.handle('editor:export-pdf', async (event, job, name) => {
    trusted(event); validatePDF(job);
    if (exporting) throw Error('PDF를 생성하고 있습니다. 잠시 후 다시 시도해 주세요.');
    exporting = true;
    try {
      const result = await dialog.showSaveDialog(mainWindow, {defaultPath: safeName(name || '문서.pdf'), filters: [{name: 'PDF', extensions: ['pdf']}]});
      if (result.canceled || !result.filePath) return false;
      await atomicWrite(result.filePath, await renderPDF(job)); return true;
    } finally { exporting = false; }
  });
  ipcMain.handle('editor:resolve-image', (event, url) => { trusted(event); return resolveImage(url); });
  ipcMain.on('editor:close-listener', (event, ready) => { trusted(event); closeListener = ready === true; });
  ipcMain.on('editor:close-ready', (event, token, success, message) => {
    trusted(event);
    if (token !== closingToken) return;
    clearTimeout(closeTimer); closingToken = null;
    if (success) { allowClose = true; if (quitRequested) app.quit(); else mainWindow.close(); }
    else closeFailed(message);
  });
}

async function closeFailed(message = '자동 저장이 완료되지 않았습니다.') {
  closingToken = null; clearTimeout(closeTimer);
  const result = await dialog.showMessageBox(mainWindow, {type: 'warning', message: '문서를 저장하지 못했습니다.', detail: message, buttons: ['편집기로 돌아가기', '저장하지 않고 닫기'], defaultId: 0, cancelId: 0});
  if (result.response === 1) { allowClose = true; if (quitRequested) app.quit(); else mainWindow.close(); }
  else quitRequested = false;
}

function createWindow() {
  closeListener = false; allowClose = false;
  mainWindow = new BrowserWindow({width: 1440, height: 1000, minWidth: 900, minHeight: 640, title: '지면', backgroundColor: '#f7f7f5', show: false,
    webPreferences: {preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false}});
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({url}) => { openExternal(url); return {action: 'deny'}; });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== APP_URL) { event.preventDefault(); openExternal(url); } });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('preload-error', (_event, _file, error) => console.error('Preload:', error));
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => { if (isMainFrame && code !== -3) dialog.showErrorBox('편집기를 열지 못했습니다.', `${description}\n${url}`); });
  mainWindow.on('close', event => {
    if (allowClose || !closeListener) return;
    event.preventDefault();
    if (closingToken) return;
    closingToken = randomUUID(); mainWindow.webContents.send('editor:before-close', closingToken);
    closeTimer = setTimeout(() => closeFailed('저장 응답이 지연되고 있습니다. 편집기로 돌아가 문서 저장을 시도해 주세요.'), 15000);
  });
  mainWindow.on('closed', () => { clearTimeout(closeTimer); closingToken = null; mainWindow = null; });
  mainWindow.loadURL(APP_URL);
}

function menu() {
  const mac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{label: app.name, submenu: [{role: 'about', label: '지면 정보'}, {type: 'separator'}, {role: 'hide', label: '지면 가리기'}, {role: 'hideOthers', label: '기타 가리기'}, {role: 'unhide', label: '모두 보기'}, {type: 'separator'}, {role: 'quit', label: '지면 종료'}]}] : []),
    {label: '파일', submenu: [
      {label: '문서 가져오기…', accelerator: 'CmdOrCtrl+O', click: () => command('open')},
      {label: '문서 파일로 저장…', accelerator: 'CmdOrCtrl+S', click: () => command('save')},
      {label: '마크다운 내보내기…', click: () => command('markdown')},
      {label: 'PDF 저장…', accelerator: 'CmdOrCtrl+P', click: () => command('pdf')},
      {type: 'separator'}, {role: mac ? 'close' : 'quit', label: mac ? '창 닫기' : '종료'}]},
    {label: '편집', submenu: [{role: 'undo', label: '되돌리기'}, {role: 'redo', label: '다시 실행'}, {type: 'separator'}, {role: 'cut', label: '잘라내기'}, {role: 'copy', label: '복사'}, {role: 'paste', label: '붙여넣기'}, {role: 'selectAll', label: '모두 선택'}, {type: 'separator'}, {label: '찾기 및 바꾸기', accelerator: 'CmdOrCtrl+F', click: () => command('find')}]},
    {label: '보기', submenu: [{role: 'togglefullscreen', label: '전체 화면'}, ...(!app.isPackaged ? [{role: 'toggleDevTools', label: '개발자 도구'}] : [])]},
    {label: '윈도우', submenu: [{role: 'minimize', label: '최소화'}, {role: 'zoom', label: '확대/축소'}]}
  ]));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('before-quit', () => { quitRequested = true; });
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(() => {
    app.setAboutPanelOptions({applicationName: '지면 · Jimyeon', applicationVersion: app.getVersion(), copyright: '로컬 문서 편집기'});
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    protocol.handle('app', async request => {
      try {
        const url = new URL(request.url);
        if (!['GET', 'HEAD'].includes(request.method)) return new Response('', {status: 405});
        if (url.host === 'print') {
          const html = prints.get(url.pathname.slice(1));
          return new Response(html || '', {status: html ? 200 : 404, headers: {'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline' app:; img-src data: app: https: http:; font-src data: app: https:; base-uri app:"}});
        }
        const file = bundlePath(path.join(app.getAppPath(), 'dist'), request.url);
        if (!file) return new Response('', {status: 403});
        const response = await net.fetch(pathToFileURL(file).href);
        const headers = new Headers(response.headers); headers.set('Content-Security-Policy', csp); headers.set('X-Content-Type-Options', 'nosniff');
        return new Response(request.method === 'HEAD' ? null : response.body, {status: response.status, headers});
      } catch { return new Response('파일을 찾을 수 없습니다.', {status: 404}); }
    });
    handlers(); menu(); createWindow();
    app.on('activate', () => { if (!mainWindow) createWindow(); else mainWindow.show(); });
  }).catch(error => { dialog.showErrorBox('앱을 시작하지 못했습니다.', error.message); app.quit(); });
  // This personal editor has no background work after its last window closes.
  app.on('window-all-closed', () => app.quit());
}
