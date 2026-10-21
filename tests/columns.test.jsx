import {afterEach,describe,expect,it} from 'vitest';
import {BlockNoteEditor,getNodeById} from '@blocknote/core';
import {SideMenuExtension} from '@blocknote/core/extensions';
import {TextSelection} from 'prosemirror-state';
import {schema} from '../src/blocks';
import {arrangeColumns,canArrangeColumns,columnDropTarget,insertColumnRow,moveBeside,nestedColumnDropCursor} from '../src/columns';
import {blockSelection,selectBlocks,selectedBlockIds} from '../src/block-selection';
import {loadDocument,saveDocument,emptyDocument} from '../src/storage';
const p=(id,content)=>({id,type:'paragraph',content});
const fixture=()=>[{id:'outer',type:'columnList',children:[{id:'photoColumn',type:'column',props:{width:.4},children:[{id:'photo',type:'image',props:{url:'data:image/png;base64,YQ==',previewWidth:165}}]},{id:'rightColumn',type:'column',props:{width:1.6},children:[{...p('contact','Contact.'),content:[{type:'text',text:'Contact.',styles:{bold:true}}]},p('tel','Tel. 010 0000 0000'),{...p('blog','Blog'),content:[{type:'link',href:'https://example.com',content:[{type:'text',text:'Blog',styles:{}}]}]},p('email','Email'),p('git','Git')]}]},p('after','Career')];
const editors=[];
function create(blocks=fixture()) {const e=BlockNoteEditor.create({schema,initialContent:blocks,extensions:[blockSelection()]});const root=document.createElement('div');document.body.append(root);e.mount(root);editors.push(e);return e}
afterEach(()=>{for(const e of editors)e._tiptapEditor.destroy();editors.length=0;document.body.replaceChildren()});
describe('independent rows inside columns',()=>{
 it('arranges only Tel into four columns below the standalone Contact block, and undoes atomically',()=>{
  const e=create(),before=e.document;expect(arrangeColumns(e,[e.getBlock('tel')],4)).toBe(true);
  const right=e.getBlock('rightColumn');expect(right.children.map(b=>b.type)).toEqual(['paragraph','columnList','paragraph','paragraph','paragraph']);
  expect(right.children[0]).toEqual(before[0].children[1].children[0]);expect(right.children[1].children).toHaveLength(4);
  expect(right.children[1].children[0].children[0].id).toBe('tel');expect(e.getBlock('photo')).toEqual(before[0].children[0].children[0]);
  e.undo();expect(e.document).toEqual(before);e.redo();expect(e.getBlock('rightColumn').children[1].type).toBe('columnList');
 });
 it('side drops split just Tel, then extend the inner contact row without pulling in the photo or heading',()=>{
  const e=create(),before=e.document;
  expect(moveBeside(e,[e.getBlock('blog')],'tel','right')).toBe(true);
  let inner=e.getBlock('rightColumn').children[1];expect(inner.type).toBe('columnList');expect(inner.children[0].children[0].id).toBe('tel');
  expect(moveBeside(e,[e.getBlock('email')],inner.children[1].id,'right')).toBe(true);
  inner=e.getBlock(inner.id);expect(moveBeside(e,[e.getBlock('git')],inner.children[2].id,'right')).toBe(true);
  const right=e.getBlock('rightColumn');expect(right.children.map(b=>b.type)).toEqual(['paragraph','columnList']);
  expect(right.children[1].children.map(c=>c.children[0].id)).toEqual(['tel','blog','email','git']);
  expect(e.getBlock('blog').content[0].href).toBe('https://example.com');expect(e.getBlock('photo')).toEqual(before[0].children[0].children[0]);
  expect(e.document[1]).toEqual(before[1]);expect(e.prosemirrorState.doc.check()).toBeUndefined();
 });
 it('inserts slash rows in the current column rather than after the entire portrait row',()=>{
  const e=create();e.insertBlocks([p('empty','')],'contact','after');e.setTextCursorPosition('empty','start');insertColumnRow(e,3);
  expect(e.getBlock('empty')).toBeUndefined();expect(e.getBlock('rightColumn').children[1].type).toBe('columnList');expect(e.getBlock('rightColumn').children[1].children).toHaveLength(3);
  expect(e.document.map(b=>b.id)).toEqual(['outer','after']);
 });
 it('groups selected adjacent siblings in their original order and rejects blocks from different columns',()=>{
  const e=create();expect(canArrangeColumns(e,[e.getBlock('photo'),e.getBlock('tel')])).toBe(false);
  expect(arrangeColumns(e,[e.getBlock('git'),e.getBlock('blog'),e.getBlock('email')],3)).toBe(true);
  expect(e.getBlock('rightColumn').children[2].children.map(c=>c.children[0].id)).toEqual(['blog','email','git']);
 });
 it('keeps content when a move empties a source column, and unwraps the resulting one-column row',()=>{
  const e=create([{id:'source',type:'columnList',children:[{id:'a',type:'column',children:[p('one','one')]},{id:'b',type:'column',children:[p('two','two')]}]},p('target','target')]);
  expect(moveBeside(e,[e.getBlock('one')],'target','right')).toBe(true);expect(e.document[0].id).toBe('two');expect(e.getBlock('one').content[0].text).toBe('one');expect(e.prosemirrorState.doc.check()).toBeUndefined();
 });
 it('rejects self and ancestor drops without changing content',()=>{const e=create(),before=e.document;expect(moveBeside(e,[e.getBlock('outer')],'tel','right')).toBe(false);expect(moveBeside(e,[e.getBlock('tel')],'tel','left')).toBe(false);expect(e.document).toEqual(before)});
 it('unwraps a row when a selected range empties all its old columns',()=>{
  const e=create([{id:'list',type:'columnList',children:[{id:'left',type:'column',children:[p('a','a')]},{id:'right',type:'column',children:[p('b','b')]}]}]);
  expect(moveBeside(e,[e.getBlock('a'),e.getBlock('b')],'left','right')).toBe(true);expect(e.document.map(b=>b.id)).toEqual(['a','b']);expect(e.prosemirrorState.doc.check()).toBeUndefined();
 });
 it('does not edit a locked document through layout commands',()=>{const e=create(),before=e.document;e.isEditable=false;expect(arrangeColumns(e,[e.getBlock('tel')],2)).toBe(false);expect(insertColumnRow(e,2)).toBe(false);expect(moveBeside(e,[e.getBlock('blog')],'tel','right')).toBe(false);expect(e.document).toEqual(before)});
 it('copies with fresh IDs instead of moving or duplicating existing IDs',()=>{const e=create();expect(moveBeside(e,[e.getBlock('blog')],'tel','right',{copy:true})).toBe(true);const copy=e.getBlock('rightColumn').children[1].children[1].children[0];expect(copy.id).not.toBe('blog');expect(copy.content).toEqual(e.getBlock('blog').content);expect(e.getBlock('rightColumn').children.filter(b=>b.id==='blog')).toHaveLength(1)});
 it('starts a newly divided row with 1/N widths, without resetting its outer row',()=>{
  const e=create();moveBeside(e,[e.getBlock('blog')],'tel','right');const inner=e.getBlock('rightColumn').children[1];
  e.updateBlock(inner.children[0],{props:{width:1.4}});e.updateBlock(inner.children[1],{props:{width:.6}});
  moveBeside(e,[e.getBlock('email')],inner.children[1].id,'right');expect(e.getBlock(inner.id).children.map(c=>c.props.width)).toEqual([1,1,1]);expect(e.getBlock('outer').children.map(c=>c.props.width)).toEqual([.4,1.6]);
 });
 it('round-trips nested rows and preserves selection of individual nested blocks',async()=>{const e=create();moveBeside(e,[e.getBlock('blog')],'tel','right');selectBlocks(e,['tel','blog']);expect(selectedBlockIds(e)).toEqual(['tel','blog']);const doc={...emptyDocument(),blocks:e.document};await saveDocument(doc);expect((await loadDocument()).blocks).toEqual(doc.blocks)});
 it('uses the short Tel block for the drop target and cursor, not its portrait-height parent',()=>{
  const e=create(),view=e.prosemirrorView,found=getNodeById('tel',view.state.doc),content=view.nodeDOM(found.posBeforeNode).querySelector('.bn-block-content');
  content.getBoundingClientRect=()=>({left:200,right:600,top:40,bottom:65,width:400,height:25});view.posAtCoords=()=>({pos:found.posBeforeNode+2,inside:found.posBeforeNode});
  const event={clientX:595,clientY:50};expect(columnDropTarget(event,view)).toMatchObject({id:'tel',side:'right',pos:found.posBeforeNode});expect(nestedColumnDropCursor.hooks.computeDropPosition({event,view,defaultPosition:null})).toEqual({pos:found.posBeforeNode,orientation:'block-vertical-right'});
  expect(columnDropTarget({...event,clientY:150},view)).toBeNull();
 });
});
describe('dragging onto the side edge of a block',()=>{
 // jsdom has no layout or DataTransfer: Source sits above y=40 and Target's line spans x 100-700, y 40-60.
 function setup(){
  const e=create([p('source','hello world'),p('target','target')]),view=e.prosemirrorView,at=id=>getNodeById(id,view.state.doc).posBeforeNode;
  const box=(left,top,right,bottom)=>()=>({left,top,right,bottom,width:right-left,height:bottom-top,x:left,y:top});
  view.dom.querySelector('.bn-block-group').getBoundingClientRect=box(0,0,800,100);
  const target=view.nodeDOM(at('target')).querySelector('.bn-block-content');target.getBoundingClientRect=box(100,40,700,60);
  view.posAtCoords=({top})=>top<40?{pos:at('source')+8,inside:-1}:{pos:at('target')+2,inside:-1};
  const data=new Map(),dataTransfer={files:[],get types(){return [...data.keys()]},getData:type=>data.get(type)??'',setData:(type,value)=>data.set(type,value),clearData:()=>data.clear(),setDragImage(){},effectAllowed:'',dropEffect:''};
  const fire=(element,type,clientX,clientY)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{clientX,clientY,dataTransfer});element.dispatchEvent(event)};
  const drop=()=>{fire(target,'drop',105,50);fire(target,'dragend',105,50)};
  const cursor=()=>nestedColumnDropCursor.hooks.computeDropPosition({event:{clientX:105,clientY:50},view,defaultPosition:'default'});
  return {e,view,at,fire,drop,cursor,source:view.nodeDOM(at('source')).querySelector('.bn-block-content')};
 }
 const texts=e=>e.document.map(b=>[b.type,b.content?.map(c=>c.text).join('')]);
 it('moves only the selected text and keeps the rest of its block',()=>{
  const {e,view,at,fire,drop,cursor,source}=setup();
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,at('source')+8,at('source')+13)));
  fire(source,'dragstart',150,10);expect(cursor()).toBe('default');drop();
  expect(texts(e)).toEqual([['paragraph','hello '],['paragraph','worldtarget']]);expect(e.prosemirrorState.doc.check()).toBeUndefined();
 });
 it('still places a block dragged by its handle in a new column',()=>{
  const {e,view,at,fire,drop,cursor}=setup(),handle=document.createElement('div');view.dom.parentElement.append(handle);
  handle.addEventListener('dragstart',event=>e.getExtension(SideMenuExtension).blockDragStart(event,e.getBlock('source')));
  fire(handle,'dragstart',0,10);expect(cursor()).toEqual({pos:at('target'),orientation:'block-vertical-left'});drop();
  expect(e.document).toHaveLength(1);expect(e.document[0].type).toBe('columnList');
  expect(e.document[0].children.map(c=>c.children.map(b=>b.id))).toEqual([['source'],['target']]);expect(e.getBlock('source').content[0].text).toBe('hello world');
 });
});
