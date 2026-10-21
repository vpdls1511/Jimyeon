import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.env.PORT||5174);
const origin=`http://127.0.0.1:${port}`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
let browserPromise,activeExports=0;
const imageCache=new Map();let cachedImageBytes=0;
async function resolveImage(value){
  const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('이미지 주소를 확인해 주세요.');
  const saved=imageCache.get(url.href);if(saved&&Date.now()-saved.time<300000)return saved;
  const fetched=await fetch(url,{signal:AbortSignal.timeout(12000)});
  const type=fetched.headers.get('content-type')||'';
  if(!fetched.ok||!type.startsWith('image/'))throw Error('이미지를 불러오지 못했습니다.');
  let length=0;const chunks=[];
  for await(const part of fetched.body){length+=part.length;if(length>20*1024*1024)throw Error('이미지 파일 크기가 너무 큽니다.');chunks.push(part)}
  const entry={bytes:Buffer.concat(chunks),type,time:Date.now()};
  if(saved){cachedImageBytes-=saved.bytes.length;imageCache.delete(url.href)}
  while(cachedImageBytes+length>32*1024*1024&&imageCache.size){const key=imageCache.keys().next().value;cachedImageBytes-=imageCache.get(key).bytes.length;imageCache.delete(key)}
  imageCache.set(url.href,entry);cachedImageBytes+=length;return entry;
}
function executable(){const candidates=[process.env.PUPPETEER_EXECUTABLE_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];return candidates.find(p=>p&&existsSync(p))}
async function browser(){if(!browserPromise){const executablePath=executable();if(!executablePath)throw Error('PDF 저장을 위해 Chrome이 필요합니다. Chrome을 설치한 뒤 다시 시도해 주세요.');browserPromise=puppeteer.launch({executablePath,headless:true}).catch(e=>{browserPromise=null;throw e})}return browserPromise}
export async function renderPDF(job){
  if(!['A4','A3'].includes(job.paper)||typeof job.html!=='string'||!Number.isInteger(job.pageCount)||job.pageCount<1||job.pageCount>300)throw Error('올바른 용지 미리보기가 필요합니다.');
  const chrome=await browser();
  const context=await chrome.createBrowserContext();
  try{
    const page=await context.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setViewport({width:1400,height:1000,deviceScaleFactor:1});
    await page.emulateMediaType('screen');
    await page.setRequestInterception(true);
    page.on('request',request=>{const url=request.url();if(/^(https?:|data:|blob:|about:)/.test(url))request.continue();else request.abort()});
    await page.setContent(job.html,{waitUntil:'networkidle0',timeout:30000});
    const bytes=await page.pdf({format:job.paper,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,scale:1,margin:{top:0,bottom:0,left:0,right:0},waitForFonts:true,timeout:30000});
    return bytes;
  }finally{await context.close()}
}

async function bodyJSON(request){let size=0,chunks=[];for await(const chunk of request){size+=chunk.length;if(size>100*1024*1024)throw Error('문서 크기가 너무 큽니다. 첨부 이미지 크기를 줄여 주세요.');chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
const server=http.createServer(async(request,response)=>{
  try{
    if(request.method==='POST'&&request.url==='/api/resolve-image'){
      if(request.headers.origin!==origin){response.writeHead(403);response.end();return}
      const {url}=await bodyJSON(request),image=await resolveImage(url);
      response.writeHead(200,{'Content-Type':image.type,'Cache-Control':'no-store'});response.end(image.bytes);return;
    }
    if(request.method==='POST'&&request.url==='/api/export-pdf'){
      if(request.headers.origin!==origin){response.writeHead(403);response.end();return}
      if(activeExports>=2){response.writeHead(429,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'PDF를 생성하고 있습니다. 잠시 후 다시 시도해 주세요.'}));return}
      activeExports++;
      try{const job=await bodyJSON(request),pdf=await renderPDF(job);response.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':"attachment; filename=\"document.pdf\"",'Cache-Control':'no-store','X-Preview-Pages':String(job.pageCount)});response.end(pdf)}finally{activeExports--}
      return;
    }
    if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405);response.end();return}
    let pathname;try{pathname=decodeURIComponent(new URL(request.url,origin).pathname)}catch{response.writeHead(400);response.end();return}
    if(pathname.includes('\0')){response.writeHead(400);response.end();return}
    const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!filename.startsWith(root+path.sep)){response.writeHead(403);response.end();return}
    if(!(await stat(filename)).isFile()){response.writeHead(404);response.end();return}
    response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    response.end(request.method==='HEAD'?undefined:await readFile(filename));
  }catch(error){const missing=['ENOENT','ENOTDIR'].includes(error.code);if(!response.headersSent)response.writeHead(missing?404:500,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify({error:missing?'파일을 찾을 수 없습니다.':error.code?'요청을 처리하지 못했습니다.':error.message}))}
});
server.listen(port,'127.0.0.1',()=>{console.log(`에디터: ${origin}`);if(process.argv.includes('--open')){const command=process.platform==='darwin'?'open':process.platform==='win32'?'explorer':'xdg-open';spawn(command,[origin],{stdio:'ignore',detached:true}).unref()}});
async function close(){server.close();if(browserPromise)try{await(await browserPromise).close()}catch{}process.exit(0)}
process.on('SIGINT',close);process.on('SIGTERM',close);
