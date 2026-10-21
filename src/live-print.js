import {collectStyles} from './paper';
import {footerStyle,PAGE_SIZES} from './page-settings';

const dataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
const videoFrame=video=>{try{const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);return canvas.toDataURL('image/jpeg',.92)}catch{return ''}};
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Keep geometry and typography, without duplicating every inherited UI theme
// variable on every element and on every printed page.
const frozenProperties=`display position box-sizing width min-width min-height max-width max-height margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left border-top border-right border-bottom border-left border-collapse border-spacing border-radius font-family font-size font-weight font-style font-variant line-height letter-spacing word-spacing font-feature-settings text-align text-indent text-decoration white-space word-break overflow-wrap hyphens vertical-align color background-color flex flex-direction flex-wrap column-gap row-gap align-items align-self justify-content grid-template-columns grid-template-rows grid-auto-flow top right bottom left transform transform-origin object-fit object-position aspect-ratio overflow-x overflow-y float clear table-layout opacity visibility list-style-type list-style-position direction unicode-bidi`.split(' ');
export async function freezeLiveSource(source,meta){
 const copy=source.cloneNode(true),originals=[source,...source.querySelectorAll('*')],clones=[copy,...copy.querySelectorAll('*')];
 originals.forEach((node,i)=>{
  const clone=clones[i],style=getComputedStyle(node);
  // Resolve inherited typography and dimensions once, at the live layout.
  clone.style.cssText=node.style.cssText+';'+frozenProperties.map(key=>`${key}:${style.getPropertyValue(key)}`).join(';');
  for(const attr of ['contenteditable','tabindex','data-block-range-selected','data-show-selection','data-drop-target'])clone.removeAttribute(attr);
  clone.classList.remove('ProseMirror-selectednode','ProseMirror-focused','selectedCell');
  if(node instanceof HTMLInputElement&&node.type==='checkbox')clone.toggleAttribute('checked',node.checked);
  if(node.classList.contains('find-match'))clone.style.setProperty('background-color','transparent','important');
 });
 copy.querySelectorAll('.page-tools,.page-emoji,.cover-actions,.locked-note,.bn-side-menu,.bn-toolbar,.bn-suggestion-menu,.bn-file-panel,.bn-file-block-top,.bn-resize-handle,.column-resize-layer,.bn-trailing-block,.web-edit,.button-config,.button-settings,.emoji-popover,script').forEach(node=>node.remove());
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
 copy.style.setProperty('position','absolute','important');copy.style.setProperty('left','0','important');copy.style.setProperty('margin','0','important');copy.style.setProperty('transform','none','important');
 copy.classList.add('frozen-document');
 return copy;
}

export async function livePrintJob(source,meta,layout){
 if(!layout)throw Error('페이지 구성을 마친 뒤 다시 시도해 주세요.');
 const frozen=await freezeLiveSource(source,meta),p=layout.metrics,size=PAGE_SIZES[p.paper];
 const footer=document.createElement('div');footer.className='printed-page-number';Object.assign(footer.style,{position:'absolute',fontFamily:getComputedStyle(source).fontFamily,...footerStyle(meta)});
 const pages=Array.from({length:layout.count},(_,index)=>{
  const content=frozen.cloneNode(true);content.style.setProperty('top',-index*p.stride+'px','important');
  footer.textContent=`${index+1}/${layout.count}`;
  return `<section class="printed-sheet">${content.outerHTML}<div class="printed-margin" style="top:0;height:${p.top}px"></div><div class="printed-margin" style="bottom:0;height:${p.bottom}px"></div>${p.pageNumber==='none'?'':footer.outerHTML}</section>`;
 });
 return {paper:p.paper,pageCount:layout.count,html:`<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="${escape(new URL('/',location.href).href)}"><style>${collectStyles(document,{activeMediaOnly:true})}</style><style>
 @page{size:${size.width}mm ${size.height}mm;margin:0}
 html,body{margin:0!important;padding:0!important;background:#fff!important;width:${p.width}px!important;overflow:visible!important}
 .printed-sheet{width:${p.width}px;height:${p.height}px;overflow:hidden;position:relative;break-after:page;page-break-after:always;background:#fff;color:#37352f}
 .printed-sheet:last-child{break-after:auto;page-break-after:auto}
 .frozen-document{width:${p.width}px!important;pointer-events:none}
 .frozen-document,.frozen-document *{break-before:auto!important;break-after:auto!important;break-inside:auto!important;orphans:1;widows:1}
 .printed-page-number{z-index:2}
 .printed-margin{position:absolute;left:0;right:0;background:#fff;z-index:1}
 *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;animation:none!important;transition:none!important}
 </style></head><body>${pages.join('')}</body></html>`};
}
