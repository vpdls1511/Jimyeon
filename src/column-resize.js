import {createExtension,getNodeById} from '@blocknote/core';
import {SideMenuExtension} from '@blocknote/core/extensions';
import {Plugin} from 'prosemirror-state';
import {closeHistory} from 'prosemirror-history';

export const COLUMN_RESIZE_STEP=10;
// Snap movement in document pixels. Restrict the available steps as well as
// the pointer delta, so reaching a minimum width never introduces a partial step.
export function snapColumnDelta(delta,leftPixels,rightPixels,zoom=1){
 if(!Number.isFinite(delta)||!Number.isFinite(zoom)||zoom<=0)return 0;
 const step=COLUMN_RESIZE_STEP*zoom,min=Math.min(48*zoom,(leftPixels+rightPixels)/2);
 const lower=Math.ceil((min-leftPixels)/step),upper=Math.floor((rightPixels-min)/step);
 const units=Math.sign(delta)*Math.round(Math.abs(delta)/step);
 if(!units||lower>upper)return 0;
 // Already-narrow imported columns can stay unchanged until a valid whole step
 // is available; clicking or making a small movement must not make them jump.
 if(units>0)return upper<=0||units<lower?0:Math.min(upper,units)*step;
 return lower>=0||units>upper?0:Math.max(lower,units)*step;
}

// Work in the two cells' measured pixels, so zoom and any saved weight scale
// cancel out. Their combined weight stays constant; all other cells stay put.
export function resizedPair(left,right,leftPixels,rightPixels,delta,minimum=48){
 const pixels=leftPixels+rightPixels,total=left+right;
 if(pixels<=0||total<=0)return {left,right};
 const min=Math.min(minimum,pixels/2),next=Math.max(min,Math.min(pixels-min,leftPixels+delta));
 const weight=total*next/pixels;
 return {left:weight,right:total-weight};
}
function adjacentPair(editor,leftId,rightId){
 const doc=editor.prosemirrorState.doc,left=getNodeById(leftId,doc),right=getNodeById(rightId,doc);
 if(!left||!right||left.node.type.name!=='column'||right.node.type.name!=='column')return null;
 const a=doc.resolve(left.posBeforeNode),b=doc.resolve(right.posBeforeNode);
 return a.parent.type.name==='columnList'&&a.parent===b.parent&&a.index()+1===b.index()?{left,right}:null;
}
export function commitColumnWidths(editor,leftId,rightId,widths){
 if(!editor.isEditable||!Number.isFinite(widths.left)||!Number.isFinite(widths.right)||widths.left<=0||widths.right<=0)return false;
 const pair=adjacentPair(editor,leftId,rightId);if(!pair)return false;
 const before=pair.left.node.attrs.width+pair.right.node.attrs.width;
 if(Math.abs(before-widths.left-widths.right)>1e-8)return false;
 if(Math.abs(pair.left.node.attrs.width-widths.left)<1e-8)return false;
 editor.transact(tr=>{closeHistory(tr);tr.setNodeAttribute(pair.left.posBeforeNode,'width',widths.left);tr.setNodeAttribute(pair.right.posBeforeNode,'width',widths.right)});
 return true;
}

export function mountColumnResize(editor,view){
 const doc=view.dom.ownerDocument,win=doc.defaultView,host=view.dom.parentElement;
 // Share the editor's stacking context so its block handles (z-index 20)
 // stay above separators, including at the left edge of nested columns.
 host.classList.add('column-resize-host');
 const layer=doc.createElement('div');layer.className='column-resize-layer';layer.contentEditable='false';host.append(layer);
 const controller=new AbortController(),signal=controller.signal,handles=new Map();
 let frame=0,gesture=null,destroyed=false;
 const panel=view.dom.closest('.editing-panel');
 const scale=()=>{const box=host.getBoundingClientRect(),style=getComputedStyle(host);return {x:box.width/(parseFloat(style.width)||host.offsetWidth||box.width||1)||1,y:box.height/(parseFloat(style.height)||host.offsetHeight||box.height||1)||1}};
 function render(){
  frame=0;if(destroyed)return;
  const origin=host.getBoundingClientRect(),s=scale(),seen=new Set();
  for(const list of view.dom.querySelectorAll('.bn-block-column-list')){
   if(!list.getClientRects().length)continue;
   const cells=[...list.children].filter(cell=>cell.classList.contains('bn-block-column'));
   for(let i=0;i<cells.length-1;i++){
    const left=cells[i],right=cells[i+1],leftId=left.dataset.id,rightId=right.dataset.id,pair=adjacentPair(editor,leftId,rightId);if(!pair)continue;
    const key=leftId+'|'+rightId;seen.add(key);
    let handle=handles.get(key);
    if(!handle){
     handle=doc.createElement('div');handle.className='column-resize-handle';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');
     handle.title='10px 단위로 너비 조절';
     handle.dataset.leftColumn=leftId;handle.dataset.rightColumn=rightId;handle.dataset.columnList=list.dataset.id;
     handle.addEventListener('pointerdown',event=>start(event,handle),{signal});
     handle.addEventListener('lostpointercapture',()=>{if(gesture?.handle===handle)finish(true)},{signal});
     handle.addEventListener('keydown',event=>keyboard(event,handle),{signal});
     layer.append(handle);handles.set(key,handle);
    }
    const a=left.getBoundingClientRect(),b=right.getBoundingClientRect(),top=Math.max(a.top,b.top),bottom=Math.min(a.bottom,b.bottom);
    Object.assign(handle.style,{left:((a.right+b.left)/2-origin.left)/s.x-6+'px',top:(top-origin.top)/s.y+'px',height:Math.max(0,bottom-top)/s.y+'px'});
    handle.setAttribute('aria-label',`${i+1}열과 ${i+2}열 사이 너비 조절`);
    const weights=gesture?.handle===handle?gesture.next:{left:pair.left.node.attrs.width,right:pair.right.node.attrs.width},percent=Math.round(100*weights.left/(weights.left+weights.right));
    handle.setAttribute('aria-valuenow',String(percent));handle.setAttribute('aria-valuemin','1');handle.setAttribute('aria-valuemax','99');handle.setAttribute('aria-valuetext',`왼쪽 ${percent}%, 오른쪽 ${100-percent}%`);
    handle.hidden=!editor.isEditable||bottom<=top;
   }
  }
  for(const [key,handle] of handles)if(!seen.has(key)){if(gesture?.handle===handle)finish(true);handle.remove();handles.delete(key)}
 }
 function schedule(){if(!destroyed&&!frame)frame=win.requestAnimationFrame(render)}
 function measurements(handle){
  const pair=adjacentPair(editor,handle.dataset.leftColumn,handle.dataset.rightColumn);if(!pair)return null;
  const left=view.nodeDOM(pair.left.posBeforeNode),right=view.nodeDOM(pair.right.posBeforeNode);
  if(!(left instanceof Element)||!(right instanceof Element))return null;
  const zoom=scale().x;
  return {left,right,leftId:pair.left.node.attrs.id,rightId:pair.right.node.attrs.id,leftWeight:pair.left.node.attrs.width,rightWeight:pair.right.node.attrs.width,leftPixels:left.getBoundingClientRect().width,rightPixels:right.getBoundingClientRect().width,zoom,minimum:48*zoom};
 }
 function start(event,handle){
  if(!editor.isEditable||event.button!==0||gesture)return;
  const data=measurements(handle);if(!data||!data.leftPixels||!data.rightPixels)return;
  event.preventDefault();event.stopPropagation();handle.focus({preventScroll:true});
  gesture={...data,handle,pointerId:event.pointerId,startX:event.clientX,next:{left:data.leftWeight,right:data.rightWeight}};
  panel?.classList.add('resizing-columns');handle.classList.add('is-resizing');
  editor.getExtension(SideMenuExtension)?.freezeMenu();handle.setPointerCapture?.(event.pointerId);
 }
 function update(event){
  if(!gesture||gesture.pointerId!==event.pointerId)return;
  event.preventDefault();event.stopPropagation();
  const g=gesture,delta=snapColumnDelta(event.clientX-g.startX,g.leftPixels,g.rightPixels,g.zoom);
  g.next=delta===0?{left:g.leftWeight,right:g.rightWeight}:resizedPair(g.leftWeight,g.rightWeight,g.leftPixels,g.rightPixels,delta,g.minimum);
  // Preview on layout frames only. The document and undo history receive one
  // two-attribute transaction when the pointer is released.
  g.left.style.flexGrow=String(g.next.left);g.right.style.flexGrow=String(g.next.right);render();
 }
 function finish(cancel=false){
  if(!gesture)return;
  const g=gesture;gesture=null;
  g.left.style.flexGrow=String(g.leftWeight);g.right.style.flexGrow=String(g.rightWeight);
  g.handle.classList.remove('is-resizing');panel?.classList.remove('resizing-columns');
  if(g.handle.hasPointerCapture?.(g.pointerId))g.handle.releasePointerCapture(g.pointerId);
  editor.getExtension(SideMenuExtension)?.unfreezeMenu();
  if(!cancel)commitColumnWidths(editor,g.leftId,g.rightId,g.next);
  schedule();
 }
 function keyboard(event,handle){
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(event.shiftKey)editor.redo();else editor.undo();return}
  if(!['ArrowLeft','ArrowRight'].includes(event.key)||!editor.isEditable)return;
  event.preventDefault();const data=measurements(handle);if(!data)return;
  const delta=snapColumnDelta((event.key==='ArrowLeft'?-1:1)*COLUMN_RESIZE_STEP*data.zoom,data.leftPixels,data.rightPixels,data.zoom);
  if(delta)commitColumnWidths(editor,data.leftId,data.rightId,resizedPair(data.leftWeight,data.rightWeight,data.leftPixels,data.rightPixels,delta,data.minimum));
 }
 doc.addEventListener('pointermove',update,{capture:true,signal});
 doc.addEventListener('pointerup',event=>{if(gesture?.pointerId===event.pointerId){update(event);finish()}},{capture:true,signal});
 doc.addEventListener('pointercancel',()=>finish(true),{capture:true,signal});
 doc.addEventListener('keydown',event=>{if(gesture&&event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(true)}},{capture:true,signal});
 win.addEventListener('blur',()=>finish(true),{signal});win.addEventListener('resize',schedule,{signal});
 view.dom.addEventListener('scroll',schedule,{capture:true,signal});
 const observer=new ResizeObserver(schedule);observer.observe(view.dom);schedule();
 return {update(){if(gesture&&!adjacentPair(editor,gesture.leftId,gesture.rightId))finish(true);schedule()},destroy(){destroyed=true;finish(true);controller.abort();observer.disconnect();win.cancelAnimationFrame(frame);layer.remove();host.classList.remove('column-resize-host')}};
}
export const pairColumnResize=createExtension(({editor})=>({key:'pairColumnResize',prosemirrorPlugins:[new Plugin({view:view=>mountColumnResize(editor,view)})]}));
