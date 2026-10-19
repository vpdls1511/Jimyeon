import {Previewer} from 'pagedjs';
import {frozenPageHTML,paperCSS,paperSize,PX_PER_MM} from './paper';
import {fragmentColumns,fragmentTables} from './column-pagination';

let ready = false;
const send = data => parent.postMessage(data, location.origin);
window.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='p'){event.preventDefault();send({type:'paper-request-export'})}});
const waitImages = root => Promise.all([...root.querySelectorAll('img')].map(img =>
  Promise.race([img.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 8000))])));
const dataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
async function embedImages(root){
  await Promise.all([...root.querySelectorAll('img')].map(async img=>{
    const url=img.src;
    if(!url||url.startsWith('data:'))return;
    try{
      const external=new URL(url).origin!==location.origin;
      const response=external?await fetch('/api/resolve-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}):await fetch(url);
      if(!response.ok)throw Error('이미지를 불러오지 못했습니다.');
      img.src=await dataURL(await response.blob());
    }catch{
      const missing=document.createElement('div');missing.className='print-media-card';missing.textContent='이미지를 불러오지 못했습니다. 이미지 파일을 직접 넣어 주세요.';img.replaceWith(missing);
    }
  }));
}

window.addEventListener('message', async event => {
  if (event.source !== parent || event.origin !== location.origin || event.data.type !== 'render-paper' || ready) return;
  ready = true;
  const {html,css,paper,token} = event.data;
  try {
    const size = paperSize(paper);
    const styles = css + '\n' + paperCSS(paper);
    const baseStyle = document.createElement('style');
    baseStyle.textContent = styles;
    document.head.append(baseStyle);
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;width:${size.width-32}mm`;
    probe.innerHTML = html;
    document.body.append(probe);
    await embedImages(probe);
    await document.fonts.ready;
    await waitImages(probe);
    fragmentColumns(probe.querySelector('.print-document'),(size.height-32)*PX_PER_MM);
    fragmentTables(probe.querySelector('.print-document'),(size.height-32)*PX_PER_MM);
    const prepared=probe.innerHTML;
    probe.remove();
    const paged = new Previewer();
    const flow = await paged.preview(prepared, [{[location.href]:paperCSS(paper)}], document.querySelector('#pages'));
    await document.fonts.ready;
    await waitImages(document.querySelector('#pages'));
    let overflow=0;
    for(const page of document.querySelectorAll('.pagedjs_page')){
      const area=page.querySelector('.pagedjs_area').getBoundingClientRect();
      const walker=document.createTreeWalker(page.querySelector('.pagedjs_page_content'),NodeFilter.SHOW_TEXT);
      let node,count=0,details=[];
      // Pre-wrap spaces can hang beyond a soft line ending without visible ink.
      while((node=walker.nextNode())){if(!node.textContent.trim()||node.parentElement.closest('.katex-mathml'))continue;const range=document.createRange();range.selectNodeContents(node);for(const box of range.getClientRects())if(box.height&&(box.top<area.top-1||box.bottom>area.bottom+1||box.right>area.right+4)){count++;if(details.length<3)details.push({text:node.textContent.slice(0,35),top:box.top-area.top,bottom:box.bottom-area.bottom,right:box.right-area.right})}}
      page.dataset.overflowCount=count;overflow+=count;
      page.dataset.overflowDetails=JSON.stringify(details);
    }
    const screen = document.createElement('style');
    screen.dataset.previewChrome = '';
    screen.textContent = `html,body{background:#eaeae7!important;overflow:hidden!important} #pages{padding:24px} .pagedjs_pages{display:flex;flex-direction:column;gap:28px} .pagedjs_page{background:#fff!important;margin:0!important;box-shadow:0 2px 12px #0002;position:relative} .pagedjs_page::after{content:attr(data-page-number)' 페이지';position:absolute;bottom:-21px;left:0;right:0;text-align:center;font:11px -apple-system,sans-serif;color:#777}`;
    document.head.append(screen);
    window.createPrintJob = () => frozenPageHTML(document,paper);
    const height = Math.ceil(document.querySelector('#pages').getBoundingClientRect().height + 8);
    send({type:'paper-ready',token,count:flow.total,height,width:size.width*PX_PER_MM+48,overflow});
  } catch (error) {
    console.error('Pagination failed',error.stack);
    send({type:'paper-error',token,message:error.message || '용지를 구성하지 못했습니다.'});
  }
});
send({type:'paper-frame-ready'});
