import {createExtension,fragmentToBlocks,getNearestBlockPos,getNodeById} from '@blocknote/core';
import {ColumnBlock,ColumnListBlock} from '@blocknote/xl-multi-column';
import {Plugin} from 'prosemirror-state';
import {closeHistory} from 'prosemirror-history';
import {pairColumnResize} from './column-resize';

const column=children=>({type:'column',props:{width:1},children});
const row=children=>({type:'columnList',children});
const includes=(block,id)=>block.id===id||(block.children||[]).some(child=>includes(child,id));
function locate(blocks,id,parent=null){for(const block of blocks){if(block.id===id)return {block,parent,siblings:blocks};const found=locate(block.children||[],id,block);if(found)return found}}

// Keep the existing frames and serialization, with nested rows and pair resizing.
const nestedDrop=createExtension(({editor})=>({key:'nestedColumnDrop',prosemirrorPlugins:[new Plugin({props:{
 handleDrop(view,event,slice,moved){
  if(!editor.isEditable||event.dataTransfer?.files?.length)return false;
  const target=columnDropTarget(event,view);if(!target)return false;
  const blocks=fragmentToBlocks(slice.content);if(!blocks.length)return false;
  moveBeside(editor,blocks,target.id,target.side,{copy:!moved});
  // A self drop is consumed too, so the default handler cannot move an ancestor
  // into its own descendants after this command deliberately rejects it.
  return true;
 },
}})]}));
export const nestedColumn={...ColumnBlock,config:{...ColumnBlock.config,children:{allow:'blocks'}},extensions:(ColumnBlock.extensions||[]).map(extension=>ctx=>{
 const resolved=typeof extension==='function'?extension(ctx):extension;
 return resolved.key==='multiColumnDropHandler'?nestedDrop()(ctx):resolved.key==='columnResize'?pairColumnResize()(ctx):resolved;
})};
export const columnList=ColumnListBlock;

function ownRect(element){return (element.querySelector(':scope > .bn-block > .bn-block-content')||element).getBoundingClientRect()}
export function columnDropTarget(event,view){
 const point=view.posAtCoords({left:event.clientX,top:event.clientY});if(!point)return null;
 const nearest=getNearestBlockPos(view.state.doc,point.pos),found=getNodeById(nearest.node.attrs.id,view.state.doc);
 if(!found)return null;
 let node=found.node,pos=found.posBeforeNode,element=view.nodeDOM(pos);if(!(element instanceof Element))return null;
 let rect=ownRect(element);
 // A side drop belongs to the block under the pointer, not to the full-height
 // column inherited from a taller sibling (for example a portrait).
 if(event.clientY<rect.top||event.clientY>rect.bottom)return null;
 const edge=Math.min(24,rect.width*.1);
 const side=event.clientX<=rect.left+edge?'left':event.clientX>=rect.right-edge?'right':null;
 if(!side)return null;
 const $pos=view.state.doc.resolve(pos);
 // A one-block column is already a row cell: extend that row. With multiple
 // blocks, split just the targeted block, leaving its heading/siblings outside.
 if($pos.parent.type.name==='column'&&$pos.parent.childCount===1){pos=$pos.before();node=$pos.parent;element=view.nodeDOM(pos);rect=element.getBoundingClientRect()}
 return {id:node.attrs.id,pos,side};
}
export const nestedColumnDropCursor={hooks:{computeDropPosition(context){const target=columnDropTarget(context.event,context.view);return target?{pos:target.pos,orientation:'block-vertical-'+target.side}:context.defaultPosition}}};

function fresh(block){const {id,...copy}=structuredClone(block);copy.children=(copy.children||[]).map(fresh);return copy}
// Prune only layout containers emptied by a move. A surviving one-column row
// unwraps in place, keeping every content block's ID, marks and child blocks.
function rewrite(blocks,remove,replacement,targetId){
 const result=[];
 for(const block of blocks){
  if(remove.has(block.id))continue;
  if(block.id===targetId){result.push(...(Array.isArray(replacement)?replacement:[replacement]));continue}
  const children=rewrite(block.children||[],remove,replacement,targetId);
  let next=children.length===(block.children||[]).length&&children.every((b,i)=>b===block.children[i])?block:{...block,children};
  if(next.type==='columnList'){
   const columns=next.children.filter(c=>c.children.length);
   if(columns.length===1){result.push(...columns[0].children);continue}
   if(!columns.length)continue;
   if(columns.length!==next.children.length)next={...next,children:columns};
  }
  result.push(next);
 }
 return result;
}
function applyTree(editor,before,after,focusId){
 let start=0;while(start<before.length&&before[start]===after[start])start++;
 let endBefore=before.length,endAfter=after.length;
 while(endBefore>start&&endAfter>start&&before[endBefore-1]===after[endAfter-1]){endBefore--;endAfter--}
 if(start===endBefore&&start===endAfter)return false;
 editor.transact(tr=>{closeHistory(tr);editor.replaceBlocks(before.slice(start,endBefore),after.slice(start,endAfter));if(focusId)editor.setTextCursorPosition(focusId,'start')});
 return true;
}
export function moveBeside(editor,blocks,targetId,side,{copy=false}={}){
 if(!editor.isEditable||!['left','right'].includes(side))return false;
 const before=editor.document,hit=locate(before,targetId);if(!hit||!blocks.length)return false;
 // Never move an ancestor next to a descendant or duplicate the same source.
 if(blocks.some(block=>includes(block,targetId)))return false;
 const ids=new Set(blocks.map(b=>b.id));
 const roots=blocks.filter(block=>!blocks.some(other=>other!==block&&includes(other,block.id)));
 const moving=copy?roots.map(fresh):roots,remove=copy?new Set():new Set(roots.map(b=>b.id));
 let replacement,replacedId=targetId;
 if(hit.block.type==='column'&&hit.parent?.type==='columnList'){
  const list=hit.parent;if(roots.some(b=>includes(b,list.id)))return false;
  if(!copy&&hit.block.children.every(b=>ids.has(b.id))&&hit.block.children.length===roots.length)return false;
  const children=[];
  for(const cell of list.children){
   const cleaned={...cell,children:rewrite(cell.children,remove,null,null)};
   if(cell.id===targetId&&side==='left')children.push(column(moving));
   if(cleaned.children.length)children.push(cleaned);
   if(cell.id===targetId&&side==='right')children.push(column(moving));
  }
  replacement=children.length===1?children[0].children:{...list,children:children.map(c=>({...c,props:{...c.props,width:1}}))};replacedId=list.id;
 }else{
  const target=rewrite([hit.block],remove,null,null)[0];if(!target)return false;
  replacement=row((side==='left'?[moving,[target]]:[[target],moving]).map(column));
 }
 const after=rewrite(before,remove,replacement,replacedId);
 return applyTree(editor,before,after,copy?null:roots[0].id);
}

export function canArrangeColumns(editor,blocks){
 if(!blocks.length)return false;const hit=locate(editor.document,blocks[0].id);if(!hit)return false;
 const indices=blocks.map(b=>hit.siblings.findIndex(s=>s.id===b.id)).sort((a,b)=>a-b);
 return indices[0]>=0&&indices.every((index,i)=>index===indices[0]+i)&&!blocks.some(b=>b.type==='column');
}
export function arrangeColumns(editor,blocks,count){
 if(!editor.isEditable||!canArrangeColumns(editor,blocks)||!Number.isInteger(count)||count<2||count>5)return false;
 const hit=locate(editor.document,blocks[0].id),ids=new Set(blocks.map(b=>b.id)),ordered=hit.siblings.filter(b=>ids.has(b.id));
 const cells=Array.from({length:count},(_,i)=>column(i===count-1?ordered.slice(i):ordered[i]?[ordered[i]]:[{type:'paragraph'}]));
 if(!cells.at(-1).children.length)cells.at(-1).children=[{type:'paragraph'}];
 editor.transact(tr=>{closeHistory(tr);editor.replaceBlocks(ordered,[row(cells)]);editor.setTextCursorPosition(ordered[0].id,'start')});
 editor.focus();return true;
}
export function insertColumnRow(editor,count){
 if(!editor.isEditable||!Number.isInteger(count)||count<2||count>5)return false;
 const block=editor.getTextCursorPosition().block,layout=row(Array.from({length:count},()=>column([{type:'paragraph'}])));
 const empty=block.type==='paragraph'&&!block.content.length&&!block.children.length;
 const inserted=empty?editor.replaceBlocks([block],[layout]).insertedBlocks[0]:editor.insertBlocks([layout],block,'after')[0];
 editor.setTextCursorPosition(inserted.children[0].children[0],'start');editor.focus();
}
