import path from 'node:path';
import {existsSync} from 'node:fs';

export const missingBrowserMessage='PDF 저장을 위해 Chrome 또는 Edge가 필요합니다. 설치한 뒤 다시 시도하거나, 환경 변수 PUPPETEER_EXECUTABLE_PATH에 실행 파일 경로를 지정해 주세요.';
export function executable({env=process.env,platform=process.platform,exists=existsSync}={}){
  const win=path.win32,programs=[env.ProgramFiles,env['ProgramFiles(x86)'],env.LOCALAPPDATA].filter(Boolean);
  const candidates=[env.PUPPETEER_EXECUTABLE_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',...(platform==='win32'?programs.flatMap(base=>[win.join(base,'Google/Chrome/Application/chrome.exe'),win.join(base,'Microsoft/Edge/Application/msedge.exe')]):[]),'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
  return candidates.find(p=>p&&exists(p));
}
// Keeps one browser alive; a closed or dead connection is dropped so the next call launches a fresh one.
export function createBrowserSession(launch){
  let promise=null;
  const start=()=>{const current=launch().then(browser=>{browser.on('disconnected',()=>{if(promise===current)promise=null});return browser},e=>{if(promise===current)promise=null;throw e});return promise=current};
  return {
    async context(){const browser=await(promise||start());return {browser,context:await browser.createBrowserContext()}},
    async close(){if(promise)try{await(await promise).close()}catch{}promise=null}
  };
}
