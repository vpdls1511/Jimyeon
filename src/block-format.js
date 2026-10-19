import {createExtension,getNodeById} from '@blocknote/core';
import {getMarkRange} from '@tiptap/core';
import {Plugin,PluginKey} from 'prosemirror-state';
import {Decoration,DecorationSet} from 'prosemirror-view';
import {closeHistory} from 'prosemirror-history';
import {selectedBlockIds} from './block-selection';

export const COLOR_OPTIONS=[['default','기본'],['gray','회색'],['brown','갈색'],['orange','주황색'],['yellow','노란색'],['green','초록색'],['blue','파란색'],['purple','보라색'],['pink','분홍색'],['red','빨간색']];
export const TEXT_COLORS={gray:'#787774',brown:'#9f6b53',orange:'#d9730d',yellow:'#cb912f',green:'#448361',blue:'#0b6e99',purple:'#9065b0',pink:'#c14c8a',red:'#d44c47'};
export const validColor=value=>value==='default'||Object.hasOwn(TEXT_COLORS,value)||/^#[\da-f]{6}$/i.test(value);
export const spacingValue=value=>Number.isFinite(Number(value))?Math.min(96,Math.max(-1,Number(value))):-1;

export function withBlockSpacing(spec){
 if(spec.config.layoutOnly||spec.config.type==='pageBreak')return spec;
 return {...spec,config:{...spec.config,propSchema:{...spec.config.propSchema,spaceBefore:{default:-1},spaceAfter:{default:-1}}}};
}
export function formatTargets(editor,block){
 const ids=selectedBlockIds(editor);
 if(ids.length)return !block||ids.includes(block.id)?ids.map(id=>editor.getBlock(id)).filter(Boolean):[block];
 const selected=editor.getSelection()?.blocks;
 return selected?.length&&(!block||selected.some(b=>b.id===block.id))?selected:[block||editor.getTextCursorPosition().block];
}
export function setBlockSpacing(editor,ids,values){
 if(!editor.isEditable)return false;
 const blocks=ids.map(id=>editor.getBlock(id)).filter(b=>b&&'spaceBefore' in b.props);
 const props=Object.fromEntries(Object.entries(values).filter(([key])=>['spaceBefore','spaceAfter'].includes(key)).map(([key,value])=>[key,spacingValue(value)]));
 if(!blocks.length||!Object.keys(props).length)return false;
 editor.transact(tr=>{closeHistory(tr);blocks.forEach(block=>editor.updateBlock(block,{props}))});
 return true;
}
export function adjustBlockSpacing(editor,property,delta){
 const targets=formatTargets(editor).filter(b=>'spaceBefore' in b.props);
 if(!editor.isEditable||!targets.length)return false;
 const values=targets.map(block=>{
  const found=getNodeById(block.id,editor.prosemirrorState.doc),dom=found&&editor.prosemirrorView.nodeDOM(found.posBeforeNode);
  const value=spacingValue(block.props[property]);
  const effective=value<0?(parseFloat(dom&&getComputedStyle(dom)[property==='spaceBefore'?'paddingTop':'paddingBottom'])||0)*.75:value;
  return {block,value:Math.max(0,Math.min(96,Math.round((effective+delta)*2)/2))};
 });
 editor.transact(tr=>{closeHistory(tr);values.forEach(({block,value})=>editor.updateBlock(block,{props:{[property]:value}}))});
 return true;
}

function spacingDecorations(doc){
 const decorations=[];
 doc.descendants((node,pos)=>{
  if(node.type.name!=='blockContainer')return;
  const content=node.firstChild;if(!content||!('spaceBefore' in content.attrs))return;
  const before=spacingValue(content.attrs.spaceBefore),after=spacingValue(content.attrs.spaceAfter),divider=content.type.name==='divider';
  const automatic=divider?'8pt':'0pt';
  const style=`--block-before:${before<0?automatic:before+'pt'};--block-after:${after<0?`calc(var(--block-gap, 0pt) + ${automatic})`:after+'pt'}`;
  decorations.push(Decoration.node(pos,pos+node.nodeSize,{class:'formatted-block',style}));
 });
 return DecorationSet.create(doc,decorations);
}
const key=new PluginKey('blockAppearance');
export const blockAppearance=createExtension({key:'blockAppearance',prosemirrorPlugins:[new Plugin({
 key,state:{init:(_,state)=>spacingDecorations(state.doc),apply:(tr,old)=>tr.docChanged?spacingDecorations(tr.doc):old.map(tr.mapping,tr.doc)},
 props:{decorations:state=>key.getState(state)},
})],keyboardShortcuts:{
 'Mod-Alt-ArrowUp':({editor})=>adjustBlockSpacing(editor,'spaceBefore',2),
 'Mod-Alt-ArrowDown':({editor})=>adjustBlockSpacing(editor,'spaceAfter',2),
 'Mod-Alt-Shift-ArrowUp':({editor})=>adjustBlockSpacing(editor,'spaceBefore',-2),
 'Mod-Alt-Shift-ArrowDown':({editor})=>adjustBlockSpacing(editor,'spaceAfter',-2),
}});

export function linkRanges(editor){
 const {selection,doc,schema}=editor.prosemirrorState,link=schema.marks.link;
 if(!link)return [];
 if(selection.empty){const range=getMarkRange(selection.$from,link);return range?[range]:[]}
 const ranges=[];
 for(const range of selection.ranges)doc.nodesBetween(range.$from.pos,range.$to.pos,(node,pos)=>{
  if(node.isText&&link.isInSet(node.marks))ranges.push({from:Math.max(pos,range.$from.pos),to:Math.min(pos+node.nodeSize,range.$to.pos)});
 });
 return ranges;
}
export function setLinkColor(editor,color){
 if(!editor.isEditable||!validColor(color))return false;
 const ranges=linkRanges(editor),mark=editor.prosemirrorState.schema.marks.textColor;
 if(!ranges.length||!mark)return false;
 editor.transact(tr=>{closeHistory(tr);for(const {from,to} of ranges){tr.removeMark(from,to,mark);if(color!=='default')tr.addMark(from,to,mark.create({stringValue:color}))}});
 editor.focus();return true;
}
