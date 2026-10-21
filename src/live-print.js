import {collectStyles} from './paper';
import {footerStyle,pageMetrics,PAGE_SIZES} from './page-settings';

const dataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
const videoFrame=video=>{try{const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);return canvas.toDataURL('image/jpeg',.92)}catch{return ''}};
// The print page has another origin (null in the browser, app://print on the desktop), so it cannot fetch the editor's
// web fonts. Embed the faces that the printed copy names and the live page loaded, in their first format, once per job.
async function inlineFonts(css,copy){
 await document.fonts?.ready;
 const name=family=>family.trim().replace(/^["']|["']$/g,''),face=(family,style,weight)=>[name(family),style||'normal',{normal:'400',bold:'700'}[weight||'normal']||weight].join('|');
 const families=new Set([copy,...copy.querySelectorAll('*')].flatMap(el=>(el.style?.fontFamily||'').split(',').map(name))),loaded=new Set([...(document.fonts||[])].filter(font=>font.status==='loaded').map(font=>face(font.family,font.style,font.weight)));
 for(const sheet of document.styleSheets){let rules=[];try{rules=[...sheet.cssRules]}catch{}for(const rule of rules){
  const family=rule.type===5&&rule.style.getPropertyValue('font-family'),url=family&&families.has(name(family))&&loaded.has(face(family,rule.style.getPropertyValue('font-style'),rule.style.getPropertyValue('font-weight')))&&rule.style.getPropertyValue('src').match(/url\((['"]?)([^)'"\s]+)\1\)/)?.[2];
  if(!url||url.startsWith('data:'))continue;
  const href=new URL(url,sheet.href||document.baseURI).href;
  try{const response=await fetch(href);if(response.ok)css=css.replaceAll(`url("${href}")`,`url("${await dataURL(await response.blob())}")`)}catch{}
 }}
 return css;
}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Keep geometry and typography, without duplicating every inherited UI theme
// variable on every element and on every printed page.
const frozenProperties=`display position box-sizing width min-width min-height max-width max-height margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left border-top border-right border-bottom border-left border-collapse border-spacing border-radius font-family font-size font-weight font-style font-variant line-height letter-spacing word-spacing font-feature-settings text-align text-indent text-decoration white-space word-break overflow-wrap hyphens vertical-align color background-color flex flex-direction flex-wrap column-gap row-gap align-items align-self justify-content grid-template-columns grid-template-rows grid-auto-flow top right bottom left transform transform-origin object-fit object-position aspect-ratio overflow-x overflow-y float clear table-layout opacity visibility list-style-type list-style-position direction unicode-bidi`.split(' ');
// Live boxes of frozen nodes in unscaled document pixels; low/high also cover descendants.
const boxes=new WeakMap(),wholes=new WeakMap(),px=value=>parseFloat(value)||0,blankImage='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export async function freezeLiveSource(source,meta){
 const copy=source.cloneNode(true),originals=[source,...source.querySelectorAll('*')],clones=[copy,...copy.querySelectorAll('*')];
 const origin=source.getBoundingClientRect(),scale=origin.width/pageMetrics(meta).width||1;
 originals.forEach((node,i)=>{
  const clone=clones[i],style=getComputedStyle(node);
  if(node.getClientRects().length){const r=node.getBoundingClientRect(),top=(r.top-origin.top)/scale,bottom=(r.bottom-origin.top)/scale;boxes.set(clone,{top,bottom,low:top,high:bottom,height:style.getPropertyValue('height')})}
  // Resolve inherited typography and dimensions once, at the live layout.
  clone.style.cssText=node.style.cssText+';'+frozenProperties.map(key=>`${key}:${style.getPropertyValue(key)}`).join(';');
  for(const attr of ['contenteditable','tabindex','data-block-range-selected','data-show-selection','data-drop-target'])clone.removeAttribute(attr);
  clone.classList.remove('ProseMirror-selectednode','ProseMirror-focused','selectedCell');
  if(node instanceof HTMLInputElement&&node.type==='checkbox')clone.toggleAttribute('checked',node.checked);
  if(node.classList.contains('find-match'))clone.style.setProperty('background-color','transparent','important');
 });
 copy.querySelectorAll('.page-tools,.page-emoji,.cover-actions,.locked-note,.bn-side-menu,.bn-toolbar,.bn-suggestion-menu,.bn-file-panel,.bn-file-block-top,.bn-resize-handle,.column-resize-layer,.bn-trailing-block,.web-edit,.button-config,.button-settings,.emoji-popover,script').forEach(node=>node.remove());
 // In-flow editing controls and hints keep their measured box so the live page cuts still line up, but print nothing.
 // An equation being edited prints only its preview, and an empty expression's hint prints nothing.
 copy.querySelectorAll('.tabs-bar button[title="탭 추가"],.tabs-bar input,.inline-equation input,.bn-toggle-add-block-button,.bn-add-file-button,.web-block form,.equation form,.table-of-contents>span,[data-math-hint]').forEach(node=>[node,...node.querySelectorAll('*')].forEach(el=>{if(!el.closest('.equation-preview')||el.closest('[data-math-hint]'))el.style.setProperty('visibility','hidden','important')}));
 for(const node of copy.querySelectorAll('[data-block-range-selected]'))node.removeAttribute('data-block-range-selected');
 // The computed blue background is a transient decoration, too.
 originals.forEach((node,i)=>{if(node.hasAttribute('data-block-range-selected'))clones[i].style.setProperty('background-color','transparent','important')});
 const title=copy.querySelector('#document-title');
 if(title){const text=document.createElement('div');text.id=title.id;text.style.cssText=title.style.cssText;text.textContent=meta.title||'';title.replaceWith(text)}
 copy.querySelectorAll('select').forEach(select=>{const original=originals[clones.indexOf(select)],label=document.createElement('div');label.style.cssText=select.style.cssText;label.textContent=original?.selectedOptions?.[0]?.textContent||'';select.replaceWith(label)});
 copy.querySelectorAll('[data-content-type="pageBreak"]').forEach(node=>node.style.setProperty('opacity','0','important'));
 // Players cannot run in a PDF: keep each measured box and show the video's current frame, or a link card.
 copy.querySelectorAll('iframe,video,audio').forEach(media=>{
  const original=originals[clones.indexOf(media)],frame=media.tagName==='VIDEO'&&original.readyState>1&&original.videoWidth&&videoFrame(original),src=original.currentSrc||original.src||'',url=/^https?:/i.test(src)?src:'',box=document.createElement(frame?'img':'div');
  box.style.cssText=media.style.cssText;box.style.setProperty('height',getComputedStyle(original).height);
  if(frame)box.src=frame;
  else{const label=document.createElement(url?'a':'div');if(url)label.href=url;label.style.cssText='display:block;padding:14px;font-size:12px;line-height:1.5;color:#555;text-decoration:none;overflow-wrap:anywhere';label.textContent=[{IFRAME:'외부 임베드',VIDEO:'영상',AUDIO:'오디오'}[media.tagName],url||media.closest('[data-name]')?.dataset.name].filter(Boolean).join(' · ');box.className='print-media-card';box.append(label);box.style.setProperty('overflow','hidden');box.style.setProperty('background-color','#f7f7f5');if(box.style.display==='inline')box.style.setProperty('display','inline-block')}
  media.replaceWith(box);
 });
 await Promise.all([...copy.querySelectorAll('img')].map(async img=>{
  if(!img.src||img.src.startsWith('data:'))return;
  const url=new URL(img.src,location.href);
  if(window.desktop&&['http:','https:'].includes(url.protocol)){const image=await window.desktop.resolveImage(url.href);img.src=await dataURL(new Blob([image.bytes],{type:image.type}));return}
  const response=url.origin===location.origin?await fetch(url):await fetch('/api/resolve-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url.href})});
  if(!response.ok)throw Error('이미지를 불러오지 못했습니다. 이미지 파일로 다시 넣어 주세요.');
  img.src=await dataURL(await response.blob());
 }));
 // Extend boxes over their descendants; boxless display:contents slots take their children's reach.
 for(const node of [...copy.querySelectorAll('*')].reverse()){const box=boxes.get(node),parent=node.parentElement;if(box&&parent){const outer=boxes.get(parent)||{low:box.low,high:box.high};outer.low=Math.min(outer.low,box.low);outer.high=Math.max(outer.high,box.high);boxes.set(parent,outer)}}
 copy.style.setProperty('position','absolute','important');copy.style.setProperty('left','0','important');copy.style.setProperty('margin','0','important');copy.style.setProperty('transform','none','important');
 copy.classList.add('frozen-document');
 return copy;
}

const blank=node=>node.nodeType===8||node.nodeType===3&&!node.data.trim();
const blockLevel=style=>['block','flow-root','list-item','flex','grid','table'].includes(style.display);
// Block children stacked top to bottom: dropping some only moves the ones after them.
const stacked=node=>['block','flow-root','list-item'].includes(node.style.display)&&[...node.childNodes].every(kid=>blank(kid)||kid.nodeType===1&&(kid.style.display==='none'||boxes.has(kid)&&blockLevel(kid.style)&&['','static','relative'].includes(kid.style.position)&&['','none'].includes(kid.style.getPropertyValue('float'))&&!px(kid.style.top)&&!px(kid.style.bottom)&&['','none'].includes(kid.style.transform)));
// Top margin a block passes on after collapsing with its first children (CSS 2 §8.3.1), as [positive, negative]; null when unsure.
function marginTop(node){
 node=wholes.get(node)||node;
 const style=node.style,own=px(style.marginTop),margin=[Math.max(own,0),Math.min(own,0)];
 if(!['block','list-item'].includes(style.display)||px(style.paddingTop)||px(style.borderTopWidth)||!['','visible'].includes(style.overflowX)||!['','visible'].includes(style.overflowY))return margin;
 for(const kid of node.childNodes){
  if(blank(kid)||kid.nodeType===1&&(kid.style.display==='none'||['absolute','fixed'].includes(kid.style.position)))continue;
  if(kid.nodeType!==1||!blockLevel(kid.style))return margin;
  const inner=['','none'].includes(kid.style.getPropertyValue('float'))?marginTop(kid):null;
  return inner&&[Math.max(margin[0],inner[0]),Math.min(margin[1],inner[1])];
 }
 const box=boxes.get(node);return box&&box.bottom>box.top?margin:null;
}
// A sheet needs only the subtrees that reach it. Blocks above it become one spacer of
// their height and blocks below it are dropped, so the rest keeps its live position.
function sheetCopy(node,top,bottom){
 const box=boxes.get(node),display=node.style?.display;
 // Hidden content such as inactive tabs is never drawn; display:contents wrappers are looked through.
 if(!box&&display==='none')return node.cloneNode(false);
 if(!box&&display!=='contents'||box&&box.low>=top&&box.high<=bottom){const copy=node.cloneNode(true);wholes.set(copy,node);return copy}
 if(box&&node instanceof HTMLImageElement&&(box.high<=top||box.low>=bottom)){const copy=node.cloneNode(false);copy.src=blankImage;copy.style.setProperty('height',box.height,'important');return copy}
 const copy=node.cloneNode(false),kids=[...node.childNodes];let start=0,end=kids.length;if(box)boxes.set(copy,box);
 if(stacked(node)){
  while(end>0&&!(boxes.get(kids[end-1])?.low<bottom))end--;
  while(start<end&&!(boxes.get(kids[start])?.high>top))start++;
  if(start===end||!kids.slice(0,start).some(kid=>boxes.has(kid)))start=0;
  if(!kids.slice(end).some(kid=>boxes.has(kid)))end=kids.length;
 }
 const placed=kids.slice(start,end).map(kid=>sheetCopy(kid,top,bottom));
 if(start){
  const margin=marginTop(placed[0]),height=margin&&boxes.get(kids[start]).top-margin[0]-margin[1]-box.top-px(node.style.borderTopWidth)-px(node.style.paddingTop);
  if(height>=1){const gap=document.createElement('div');gap.className='printed-gap';gap.style.cssText=`display:block!important;height:${height}px!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important`;boxes.set(gap,{top:0,bottom:height});placed.unshift(gap)}
  else placed.unshift(...kids.slice(0,start).map(kid=>sheetCopy(kid,top,bottom)));
 }
 if(end<kids.length)copy.style.setProperty('height',box.height,'important');
 copy.append(...placed);return copy;
}

export async function livePrintJob(source,meta,layout){
 if(!layout)throw Error('페이지 구성을 마친 뒤 다시 시도해 주세요.');
 const frozen=await freezeLiveSource(source,meta),p=layout.metrics,size=PAGE_SIZES[p.paper];
 // File blocks repeat an embedded image in data-url, which printing never reads.
 frozen.querySelectorAll('[data-url^="data:"]').forEach(node=>node.removeAttribute('data-url'));
 const footer=document.createElement('div');footer.className='printed-page-number';Object.assign(footer.style,{position:'absolute',fontFamily:getComputedStyle(source).fontFamily,...footerStyle(meta)});
 const pages=Array.from({length:layout.count},(_,index)=>{
  const content=sheetCopy(frozen,index*p.stride,index*p.stride+p.height);content.style.setProperty('top',-index*p.stride+'px','important');
  footer.textContent=`${index+1}/${layout.count}`;
  return `<section class="printed-sheet">${content.outerHTML}<div class="printed-margin" style="top:0;height:${p.top}px"></div><div class="printed-margin" style="bottom:0;height:${p.bottom}px"></div>${p.pageNumber==='none'?'':footer.outerHTML}</section>`;
 });
 return {paper:p.paper,pageCount:layout.count,html:`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escape(meta.title||'문서')}</title><base href="${escape(new URL('/',location.href).href)}"><style>${await inlineFonts(collectStyles(document,{activeMediaOnly:true}),frozen)}</style><style>
 @page{size:${size.width}mm ${size.height}mm;margin:0}
 html,body{margin:0!important;padding:0!important;background:#fff!important;width:${p.width}px!important;overflow:visible!important}
 .printed-sheet{width:${p.width}px;height:${p.height}px;overflow:hidden;position:relative;break-after:page;page-break-after:always;background:#fff;color:#37352f}
 .printed-sheet:last-child{break-after:auto;page-break-after:auto}
 .frozen-document{width:${p.width}px!important;pointer-events:none}
 .frozen-document .bn-block-content::after{visibility:hidden!important}
 .frozen-document,.frozen-document *{break-before:auto!important;break-after:auto!important;break-inside:auto!important;orphans:1;widows:1}
 .printed-page-number{z-index:2}
 .printed-margin{position:absolute;left:0;right:0;background:#fff;z-index:1}
 *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;animation:none!important;transition:none!important}
 </style></head><body>${pages.join('')}</body></html>`};
}
