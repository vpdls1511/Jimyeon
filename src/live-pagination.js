import {createExtension} from '@blocknote/core';
import {Plugin,PluginKey} from 'prosemirror-state';
import {Decoration,DecorationSet} from 'prosemirror-view';
import {gapBefore,pageMetrics,PAGE_GAP} from './page-settings';

export const paginationKey=new PluginKey('livePaperPagination');
function spacer(gap){
 let element;
 if(gap.kind==='row'){
  element=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=gap.cols;cell.style.cssText=`height:${gap.height}px!important;padding:0!important;border:0!important;background:transparent!important`;element.append(cell);
 }else{element=document.createElement(gap.kind==='line'?'span':'div');element.style.cssText=`display:block;height:${gap.height}px!important;min-height:${gap.height}px!important;max-height:${gap.height}px!important;padding:0!important;margin:0!important;border:0!important;font-size:0!important;line-height:0!important;pointer-events:none`}
 element.className='paper-spacer';element.dataset.paperGap=gap.kind;element.contentEditable='false';element.setAttribute('aria-hidden','true');return element;
}
export const livePagination=createExtension({key:'livePaperPagination',prosemirrorPlugins:[new Plugin({
 key:paginationKey,
 state:{init:()=>DecorationSet.empty,apply(tr,old){const gaps=tr.getMeta(paginationKey);if(gaps)return DecorationSet.create(tr.doc,gaps.map(gap=>Decoration.widget(gap.pos,()=>spacer(gap),{side:-1,key:`${gap.kind}-${gap.pos}-${gap.height}-${gap.cols||0}`,ignoreSelection:true})));return old.map(tr.mapping,tr.doc)}},
 props:{decorations:state=>paginationKey.getState(state)},
})]});
const setGaps=(view,gaps)=>{
 const old=paginationKey.getState(view.state)?.find()||[];
 if(old.length===gaps.length&&gaps.every((gap,i)=>old[i].from===gap.pos&&old[i].spec.key===`${gap.kind}-${gap.pos}-${gap.height}-${gap.cols||0}`))return;
 view.dispatch(view.state.tr.setMeta(paginationKey,gaps).setMeta('addToHistory',false));
};

function lineStarts(view,content,origin,scale){
 const result=[],walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){
  if(!node.textContent||node.parentElement.closest('[contenteditable="false"],.katex-mathml,.paper-spacer'))continue;
  const range=document.createRange();range.selectNodeContents(node);
  const boxes=[...range.getClientRects()].filter(box=>box.width&&box.height);
  for(const box of boxes){
   const top=(box.top-origin)/scale;
   if(result.some(line=>Math.abs(line.top-top)<2))continue;
   let lo=0,hi=node.textContent.length-1;
   while(lo<hi){const mid=(lo+hi)>>1;range.setStart(node,mid);range.setEnd(node,mid+1);if(range.getBoundingClientRect().top<box.top-1)lo=mid+1;else hi=mid}
   const pos=view.posAtDOM(node,lo);
   result.push({pos,top,height:box.height/scale});
  }
 }
 return result.sort((a,b)=>a.top-b.top||a.pos-b.pos);
}

export function measureUnits(view,source,metrics){
 const origin=source.getBoundingClientRect(),scale=origin.width/metrics.width||1;
 const rect=element=>{const r=element.getBoundingClientRect();return {top:(r.top-origin.top)/scale,height:r.height/scale}};
 const unitsFor=(container,start)=>{
  const list=[];
  container.forEach((node,offset)=>{
   const pos=start+offset,outer=view.nodeDOM(pos);
   if(!(outer instanceof Element)||!outer.getClientRects().length)return;
   if(node.type.name==='columnList'){
    const columns=[];node.forEach((column,off)=>columns.push(unitsFor(column,pos+1+off+1)));
    list.push({pos,...rect(outer),columns});return;
   }
   if(node.type.name==='tabs'){
    const children=[];node.forEach((panel,off)=>children.push(...unitsFor(panel,pos+1+off+1)));
    const bar=outer.querySelector('.tabs-bar');if(bar)list.push({pos,...rect(bar)});list.push(...children);return;
   }
   if(node.type.name!=='blockContainer')return;
   const content=outer.querySelector('.bn-block-content');if(!content||!content.getClientRects().length)return;
   const bounds=rect(content),style=getComputedStyle(outer),before=parseFloat(style.paddingTop)||0,after=parseFloat(style.paddingBottom)||0;
   const unit={pos,top:bounds.top-before,height:bounds.height+before+after,manual:node.firstChild.type.name==='pageBreak'};
   if(node.firstChild.type.name==='table'){
    unit.rows=[];node.firstChild.forEach((row,off)=>{const rowPos=pos+2+off,rowDOM=view.nodeDOM(rowPos);if(rowDOM instanceof Element)unit.rows.push({pos:rowPos,...rect(rowDOM),cols:row.childCount})});
    unit.firstHeight=unit.rows[0]?.height;
   }else if(unit.height>metrics.bodyHeight&&node.firstChild.isTextblock){unit.lines=lineStarts(view,content,origin.top,scale);unit.firstHeight=unit.lines[0]?.height}
   if(node.childCount>1)unit.children=unitsFor(node.child(1),pos+1+node.firstChild.nodeSize+1);
   list.push(unit);
  });return list;
 };
 return {units:unitsFor(view.state.doc.firstChild,1),initialBottom:(view.dom.getBoundingClientRect().top-origin.top)/scale};
}

function layoutPieces(units,metrics){
 const pieces=[];let bottom=metrics.top;
 const visit=list=>{for(const unit of list){
  bottom=Math.max(bottom,unit.top+unit.height);
  if(unit.manual)pieces.push({...unit,kind:'manual'});
  else if(unit.columns)unit.columns.forEach(visit);
  else if(unit.rows)pieces.push(...unit.rows.map(row=>({...row,kind:'row'})));
  else if(unit.lines?.length)pieces.push(...unit.lines.map(line=>({...line,kind:'line'})));
  else pieces.push({...unit,kind:'block'});
  if(unit.children)visit(unit.children);
 }};visit(units);
 return {pieces:pieces.sort((a,b)=>a.top-b.top||a.pos-b.pos),bottom};
}

// Measure after every inserted gap, since browser line boxes, table borders and
// independent column heights cannot be inferred by just adding node heights.
export async function paginateLiveDOM(view,source,metrics,cancelled=()=>false,yieldToUI=()=>new Promise(resolve=>setTimeout(resolve,0))){
 const gaps=[],warnings=new Set(),manuals=new Set();let bottom=metrics.top;
 setGaps(view,[]);
 let frameStart=performance.now(),previous;
 for(let pass=0;pass<320;pass++){
  if(cancelled())return null;
  if(pass>0&&(pass%8===0||performance.now()-frameStart>12)){await yieldToUI();frameStart=performance.now();if(cancelled())return null}
  const measured=measureUnits(view,source,metrics),flow=layoutPieces(measured.units,metrics);bottom=Math.max(measured.initialBottom,flow.bottom);
  let candidate,height;
  for(const piece of flow.pieces){
   if(piece.kind==='manual'){
    if(manuals.has(piece.pos))continue;
    candidate=piece;height=(Math.floor((piece.top+.01)/metrics.stride)+1)*metrics.stride+metrics.top-piece.top;manuals.add(piece.pos);break;
   }
   if(piece.height>metrics.bodyHeight+.5){warnings.add(piece.kind==='row'?'한 표 행이 페이지 본문 높이보다 큽니다. 글자 크기나 행 내용을 줄여 주세요.':'한 블록이 페이지 본문 높이보다 큽니다. 이미지나 글자 크기를 줄여 주세요.');continue}
   const gap=gapBefore(piece.top,piece.height,metrics);
   if(gap>.5){candidate=piece;height=gap;break}
  }
  if(!candidate)break;
  const progress=`${candidate.kind}:${candidate.pos}:${Math.round(candidate.top*100)}`;
  if(progress===previous){warnings.add('이 블록을 페이지 안에 배치하지 못했습니다. 블록 크기나 여백을 줄여 주세요.');break}
  previous=progress;
  const kind=candidate.kind==='manual'?'block':candidate.kind,existing=gaps.find(gap=>gap.pos===candidate.pos&&gap.kind===kind);
  if(existing)existing.height+=height;else gaps.push({pos:candidate.pos,height,kind,cols:candidate.cols});
  setGaps(view,gaps);
  if(pass===319)warnings.add('페이지가 너무 많아 구성을 마치지 못했습니다. 문서를 나누어 주세요.');
 }
 const count=Math.max(1,Math.floor(Math.max(0,bottom+.1)/metrics.stride)+1);
 return {gaps,count,height:count*metrics.height+(count-1)*PAGE_GAP,warnings:[...warnings],metrics};
}

// Pagination only adds view decorations. Blocks, selection and undo history
// remain in the single live editor, including when content crosses pages.
export function createLivePaginator({editor,source,onLayout,onState,getMeta}){
 const view=editor.prosemirrorView;
 let timer,active=false,destroyed=false,composing=false,dragging=false,mediaResizing=false,signature='',layout,requestReveal=false,dirty=true,revision=0,lastGeometry='',running;
 const controls='.paper-spacer,.column-resize-layer,.bn-resize-handle,.bn-side-menu,.bn-toolbar,.bn-file-block-top,.bn-suggestion-menu,.emoji-popover,.web-edit,.button-settings';
 const transient=node=>node instanceof Element&&!!node.closest(controls);
 const observer=new MutationObserver(records=>{
  if(records.some(record=>{
   if(transient(record.target))return false;
   if(record.type==='attributes')return !record.target.matches?.('.formatted-block')||record.attributeName!=='style';
   return [...record.addedNodes,...record.removedNodes].some(node=>!transient(node));
  }))schedule();
 });
 const observe=()=>observer.observe(source,{subtree:true,childList:true,attributes:true,attributeFilter:['src','style','data-state','data-toggled']});
 const geometry=()=>{
  const r=source.getBoundingClientRect();
  return JSON.stringify([r.width,r.height,[...source.querySelectorAll('img,video')].map(el=>[el.getBoundingClientRect().width,el.getBoundingClientRect().height]),[...source.querySelectorAll('[data-toggled]')].map(el=>el.dataset.toggled)]);
 };
 const reflow=async()=>{
  if(destroyed)return layout;
  if(active)return running;
  if(composing||view.composing||dragging||mediaResizing||source.closest('.selecting-blocks,.resizing-columns')){schedule();return layout}
  const stamp=geometry();if(!dirty&&layout&&stamp===lastGeometry)return layout;
  active=true;dirty=false;observer.disconnect();
  const currentDoc=view.state.doc,currentRevision=revision;
  const panel=source.closest('.editing-panel'),scroll=panel?.scrollTop;
  try{
   const metrics=pageMetrics(getMeta());
   const result=await paginateLiveDOM(view,source,metrics,()=>destroyed||view.state.doc!==currentDoc||revision!==currentRevision);
   if(!result){dirty=true;return layout}
   layout=result;lastGeometry=geometry();
   const next=JSON.stringify([layout.count,layout.height,layout.warnings,metrics]);
   if(next!==signature){signature=next;onLayout(layout)}
   onState(layout.warnings.length?'크기 조정 필요':'페이지 반영됨');
   if(panel)panel.scrollTop=scroll;
   if(requestReveal&&view.hasFocus()){
    const caret=view.coordsAtPos(view.state.selection.head),box=panel?.getBoundingClientRect();
    if(box&&caret.bottom>box.bottom-24)panel.scrollTop+=caret.bottom-box.bottom+40;
    else if(box&&caret.top<box.top+12)panel.scrollTop-=box.top-caret.top+24;
   }
   requestReveal=false;
  }finally{active=false;if(!destroyed){observe();if(dirty)schedule()}}
  return layout;
 };
 function schedule(){if(destroyed||active)return;clearTimeout(timer);if(!document.hidden)timer=setTimeout(()=>{running=reflow().catch(error=>{onState('페이지 계산 실패');console.error(error)})},90)}
 const invalidate=()=>{dirty=true;revision++;schedule()};
 const visibility=()=>{clearTimeout(timer);if(!document.hidden)schedule()};
 const stop=editor.onChange(()=>{requestReveal=true;onState('페이지 계산 중…');invalidate()});
 const load=()=>schedule(),start=()=>{composing=true},end=()=>{composing=false;schedule()};
 const dragStart=()=>{dragging=true},dragEnd=()=>{dragging=false;schedule()};
 const resizeStart=event=>{if(event.target.closest?.('.bn-resize-handle'))mediaResizing=true},resizeEnd=()=>{if(mediaResizing){mediaResizing=false;invalidate()}};
 source.addEventListener('load',load,true);source.addEventListener('compositionstart',start);source.addEventListener('compositionend',end);
 source.addEventListener('dragstart',dragStart);document.addEventListener('dragend',dragEnd,true);document.addEventListener('drop',dragEnd,true);
 source.addEventListener('mousedown',resizeStart,true);source.addEventListener('touchstart',resizeStart,true);document.addEventListener('mouseup',resizeEnd,true);document.addEventListener('touchend',resizeEnd,true);window.addEventListener('blur',resizeEnd);
 document.fonts?.addEventListener('loadingdone',load);document.addEventListener('visibilitychange',visibility);observe();schedule();
 return {
  schedule:invalidate,
  async flush(){if(source.closest('.resizing-columns')||mediaResizing||dragging)throw Error('블록 크기·위치 조정을 마친 뒤 PDF를 저장해 주세요.');if(composing||view.composing)throw Error('한글 입력을 마친 뒤 PDF를 저장해 주세요.');clearTimeout(timer);await document.fonts?.ready;await Promise.all([...source.querySelectorAll('img')].map(img=>Promise.race([img.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,8000))])));if(active)await running;dirty=true;running=reflow();const result=await running;if(dirty)throw Error('문서 편집을 마친 뒤 PDF를 다시 저장해 주세요.');if(result?.warnings.length)throw Error(result.warnings[0]);return result},
  destroy(){destroyed=true;clearTimeout(timer);stop();observer.disconnect();source.removeEventListener('load',load,true);source.removeEventListener('compositionstart',start);source.removeEventListener('compositionend',end);source.removeEventListener('dragstart',dragStart);document.removeEventListener('dragend',dragEnd,true);document.removeEventListener('drop',dragEnd,true);document.removeEventListener('visibilitychange',visibility);document.fonts?.removeEventListener('loadingdone',load);source.removeEventListener('mousedown',resizeStart,true);source.removeEventListener('touchstart',resizeStart,true);document.removeEventListener('mouseup',resizeEnd,true);document.removeEventListener('touchend',resizeEnd,true);window.removeEventListener('blur',resizeEnd)},
 };
}
