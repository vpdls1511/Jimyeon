import {createExtension,createStore} from '@blocknote/core';
import {Fragment,Slice} from 'prosemirror-model';
import {Plugin,Selection,SelectionRange} from 'prosemirror-state';
import {Decoration,DecorationSet} from 'prosemirror-view';

// A rectangle can hit separate columns without selecting the intervening
// document content. Keep separate ranges instead of expanding from first to last.
function selectedEntries(doc,ids) {
  const wanted=new Set(ids),entries=[];
  doc.descendants((node,pos)=>{
    if(node.type.isInGroup('bnBlock')&&wanted.has(node.attrs.id)) {
      entries.push({id:node.attrs.id,node,pos});
      return false; // A selected parent already includes its descendants.
    }
  });
  return entries;
}

class BlockBookmark {
  constructor(ids,pos){this.ids=ids;this.pos=pos}
  map(mapping){return new BlockBookmark(this.ids,mapping.map(this.pos))}
  resolve(doc){return BlockRangeSelection.create(doc,this.ids,this.pos)}
}

export class BlockRangeSelection extends Selection {
  constructor(doc,entries) {
    const ranges=entries.map(({pos,node})=>new SelectionRange(doc.resolve(pos),doc.resolve(pos+node.nodeSize)));
    super(ranges[0].$from,ranges.at(-1).$to,ranges);
    this.entries=entries;
    this.ids=entries.map(e=>e.id);
    this.visible=false;
  }
  static create(doc,ids,fallback=0) {
    const entries=selectedEntries(doc,ids);
    return entries.length?new BlockRangeSelection(doc,entries):Selection.near(doc.resolve(Math.min(Math.max(fallback,0),doc.content.size)));
  }
  content(){return new Slice(Fragment.from(this.entries.map(e=>e.node)),0,0)}
  eq(other){return other instanceof BlockRangeSelection&&this.entries.length===other.entries.length&&this.entries.every((e,i)=>e.pos===other.entries[i].pos&&e.node.eq(other.entries[i].node))}
  map(doc,mapping){return BlockRangeSelection.create(doc,this.ids,mapping.map(this.from))}
  toJSON(){return {type:'local-block-range',ids:this.ids,pos:this.from}}
  static fromJSON(doc,json){return BlockRangeSelection.create(doc,json.ids,json.pos)}
  getBookmark(){return new BlockBookmark(this.ids,this.from)}
}
Selection.jsonID('local-block-range',BlockRangeSelection);

export function selectedBlockIds(editor) {
  const selection=editor.prosemirrorState.selection;
  return selection instanceof BlockRangeSelection?selection.ids:[];
}
export function selectBlocks(editor,ids) {
  const view=editor.prosemirrorView,selection=BlockRangeSelection.create(view.state.doc,ids,view.state.selection.from);
  if(!selection.eq(view.state.selection))view.dispatch(view.state.tr.setSelection(selection).setMeta('addToHistory',false));
}
export function clearBlockSelection(editor,atEnd=false) {
  const view=editor.prosemirrorView,selection=view.state.selection;
  if(!(selection instanceof BlockRangeSelection))return;
  const entry=atEnd?selection.entries.at(-1):selection.entries[0];
  view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(atEnd?entry.pos+entry.node.nodeSize:entry.pos),atEnd?-1:1)).setMeta('addToHistory',false));
}

const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
export function rectangleBetween(a,b){return {left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)}}
export function blocksInRectangle(candidates,rect){return candidates.filter(b=>intersects(b.rect,rect)).map(b=>b.id)}

function ownContent(element,node) {
  if(node.type.name==='column'||node.type.name==='columnList'||node.type.name==='tabPanel')return null;
  if(node.type.name==='tabs')return element.querySelector('.tabs-bar');
  return element.querySelector('.bn-block-content')||element;
}
function candidatesFor(view,panel) {
  const panelRect=panel.getBoundingClientRect(),candidates=[];
  view.state.doc.descendants((node,pos)=>{
    if(!node.type.isInGroup('bnBlock'))return;
    const outer=view.nodeDOM(pos);
    if(!(outer instanceof Element))return;
    const content=ownContent(outer,node);
    if(!content||!content.getClientRects().length)return;
    const box=content.getBoundingClientRect();
    if(box.width<=0||box.height<=0)return;
    candidates.push({id:node.attrs.id,rect:{left:box.left-panelRect.left+panel.scrollLeft,right:box.right-panelRect.left+panel.scrollLeft,top:box.top-panelRect.top+panel.scrollTop,bottom:box.bottom-panelRect.top+panel.scrollTop}});
  });
  return candidates;
}

const controls='button,a,input,textarea,select,[role="button"],[role="menu"],[role="dialog"],.bn-side-menu,.bn-resize-handle,.column-resize-handle,.bn-table-handle,.tabs-bar,.bn-suggestion-menu,.bn-trailing-block';
// A paragraph fills its column, including whitespace after the last character.
// Test actual glyph rectangles so that only a drag starting on text selects text.
function onText(target,x,y) {
  const content=target.closest('.bn-block-content');
  if(!content)return false;
  if(content.querySelector('table,img,video,audio,iframe')||content.getAttribute('contenteditable')==='false')return true;
  const walker=content.ownerDocument.createTreeWalker(content,4);
  let text;
  while((text=walker.nextNode())) {
    if(!text.textContent.trim())continue;
    const range=content.ownerDocument.createRange();range.selectNodeContents(text);
    for(const rect of range.getClientRects())if(x>=rect.left-1&&x<=rect.right+1&&y>=rect.top&&y<=rect.bottom)return true;
  }
  // Empty paragraphs retain their normal caret behavior inside the line.
  return !content.textContent.trim()&&target.closest('.bn-inline-content')!==null;
}

export function mountBlockMarquee(editor,panel) {
  const view=editor.prosemirrorView,doc=panel.ownerDocument,win=doc.defaultView;
  const controller=new AbortController(),options={capture:true,signal:controller.signal};
  let gesture=null,overlay=null,frame=0;
  const point=event=>{const r=panel.getBoundingClientRect();return {x:event.clientX-r.left+panel.scrollLeft,y:event.clientY-r.top+panel.scrollTop}};
  const visibleTop=()=>Math.max(panel.getBoundingClientRect().top,panel.querySelector('.editor-label')?.getBoundingClientRect().bottom||0);
  const draw=rect=>{
    if(!overlay){overlay=doc.createElement('div');overlay.className='block-selection-marquee';overlay.setAttribute('aria-hidden','true');doc.body.append(overlay)}
    const p=panel.getBoundingClientRect();
    const x1=Math.max(p.left,rect.left+p.left-panel.scrollLeft),x2=Math.min(p.right,rect.right+p.left-panel.scrollLeft);
    const y1=Math.max(visibleTop(),rect.top+p.top-panel.scrollTop),y2=Math.min(p.bottom,rect.bottom+p.top-panel.scrollTop);
    Object.assign(overlay.style,{left:x1+'px',top:y1+'px',width:Math.max(0,x2-x1)+'px',height:Math.max(0,y2-y1)+'px'});
  };
  const update=event=>{
    if(!gesture)return;
    gesture.last={clientX:event.clientX,clientY:event.clientY};
    const current=point(event);
    if(!gesture.active&&Math.hypot(current.x-gesture.start.x,current.y-gesture.start.y)<5)return;
    gesture.active=true;
    win.getSelection()?.removeAllRanges();
    const rect=rectangleBetween(gesture.start,current);
    const p=panel.getBoundingClientRect(),body=view.dom.getBoundingClientRect();
    const left=body.left-p.left+panel.scrollLeft,right=body.right-p.left+panel.scrollLeft;
    // A vertical drag entirely in the page margin still selects nearby blocks.
    const hitRect={...rect};
    if(rect.right<=left)hitRect.right=left+1;
    if(rect.left>=right)hitRect.left=right-1;
    const ids=blocksInRectangle(candidatesFor(view,panel),hitRect);
    if(ids.length)selectBlocks(editor,[...gesture.initialIds,...ids]);
    else if(selectedBlockIds(editor).length)clearBlockSelection(editor);
    draw(rect);
  };
  const autoScroll=()=>{
    if(!gesture?.active)return;
    const box=panel.getBoundingClientRect(),{clientY}=gesture.last,edge=36;
    const velocity=clientY<visibleTop()+edge?-Math.min(18,(visibleTop()+edge-clientY)/2):clientY>box.bottom-edge?Math.min(18,(clientY-box.bottom+edge)/2):0;
    if(velocity){const before=panel.scrollTop;panel.scrollTop+=velocity;if(before!==panel.scrollTop)update(gesture.last)}
    frame=win.requestAnimationFrame(autoScroll);
  };
  const stop=(cancel=false)=>{
    if(!gesture)return;
    const previous=gesture;gesture=null;
    win.cancelAnimationFrame(frame);frame=0;
    overlay?.remove();overlay=null;panel.classList.remove('selecting-blocks');
    if(panel.hasPointerCapture?.(previous.pointerId))panel.releasePointerCapture(previous.pointerId);
    if(cancel){
      const restored=previous.selection.$from.doc===view.state.doc?previous.selection:BlockRangeSelection.create(view.state.doc,previous.initialIds,previous.selection.from);
      view.dispatch(view.state.tr.setSelection(restored).setMeta('addToHistory',false));
    }
  };
  panel.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.pointerType==='touch'||!view.editable)return;
    const target=event.target instanceof Element?event.target:null;
    if(!target||target.closest(controls))return;
    const editorRect=view.dom.getBoundingClientRect();
    if(event.clientY<Math.max(visibleTop(),editorRect.top)||target.closest('.document-prelude,.cover'))return;
    if(onText(target,event.clientX,event.clientY))return;
    // Only the editor and surrounding paper whitespace initiate a marquee.
    if(!panel.contains(target))return;
    const selection=view.state.selection;
    gesture={start:point(event),last:event,pointerId:event.pointerId,active:false,selection,initialIds:event.shiftKey?selectedBlockIds(editor):[]};
    event.preventDefault();event.stopPropagation();
    view.focus();
    panel.setPointerCapture?.(event.pointerId);
    panel.classList.add('selecting-blocks');
  },options);
  doc.addEventListener('pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    event.preventDefault();update(event);
    if(gesture.active&&!frame)frame=win.requestAnimationFrame(autoScroll);
  },options);
  doc.addEventListener('pointerup',event=>{
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    update(event); // Also handles a fast drag whose intermediate moves coalesced.
    const active=gesture.active;
    stop();
    if(active){event.preventDefault();event.stopPropagation();view.focus()}
    else {
      clearBlockSelection(editor);
      const hit=view.posAtCoords({left:event.clientX,top:event.clientY});
      if(hit)view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(hit.pos))).setMeta('addToHistory',false));
      else if(event.clientY>=view.dom.getBoundingClientRect().bottom){editor.setTextCursorPosition(editor.document.at(-1),'end');editor.focus()}
    }
  },options);
  doc.addEventListener('pointercancel',()=>stop(true),options);
  win.addEventListener('blur',()=>stop(true),{signal:controller.signal});
  doc.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&gesture){event.preventDefault();event.stopPropagation();stop(true)}
  },options);
  doc.addEventListener('pointerdown',event=>{
    if(gesture)return;
    const target=event.target instanceof Element?event.target:null;
    if(!target||target.closest('.bn-side-menu,.bn-menu-dropdown,.bn-toolbar,[role="menu"],.block-selection-tools'))return;
    if(selectedBlockIds(editor).length)clearBlockSelection(editor);
  },{signal:controller.signal});
  return ()=>{stop();controller.abort()};
}

export const blockSelection=createExtension(({editor})=>{
  const store=createStore({ids:[]});
  return {
    key:'localBlockSelection',
    runsBefore:['notionBehavior','notionLocalShortcuts'],
    store,
    prosemirrorPlugins:[new Plugin({
      props:{
        decorations(state){
          const selection=state.selection;
          return selection instanceof BlockRangeSelection?DecorationSet.create(state.doc,selection.entries.map(({pos,node})=>Decoration.node(pos,pos+node.nodeSize,{'data-block-range-selected':'true'}))):null;
        },
        handleKeyDown(view,event){
          if(!(view.state.selection instanceof BlockRangeSelection))return false;
          if(['Backspace','Delete'].includes(event.key)){if(view.editable)editor.removeBlocks(selectedBlockIds(editor));return true}
          if(event.key==='Escape'){clearBlockSelection(editor);return true}
          if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Enter'].includes(event.key)&&!event.shiftKey&&!(event.altKey&&(event.metaKey||event.ctrlKey))){clearBlockSelection(editor,['ArrowRight','ArrowDown','Enter'].includes(event.key));return true}
          return false;
        },
      },
      view(view){
        const sync=current=>{const selection=current.state.selection,ids=selection instanceof BlockRangeSelection?selection.ids:[];if(ids.join('\0')!==store.state.ids.join('\0'))store.setState({ids})};
        sync(view);return {update:sync,destroy:()=>store.setState({ids:[]})};
      },
    })],
    mount({dom}){const panel=dom.closest('.editing-panel');if(panel)return mountBlockMarquee(editor,panel)},
  };
});
