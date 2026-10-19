import {afterEach,describe,expect,it,vi} from 'vitest';
import {BlockNoteEditor} from '@blocknote/core';
import {Selection} from 'prosemirror-state';
import {schema} from '../src/blocks';
import {notionBehavior} from '../src/notion-behavior';
import {blockSelection,BlockRangeSelection,selectBlocks,selectedBlockIds} from '../src/block-selection';
import {duplicate} from '../src/menus';
import {capturePaperSource} from '../src/paper';

let editors=[];
function create(blocks){
 const editor=BlockNoteEditor.create({schema,initialContent:blocks,extensions:[notionBehavior,blockSelection()]});
 const panel=document.createElement('section');panel.className='editing-panel';
 const root=document.createElement('div');panel.append(root);document.body.append(panel);editor.mount(root);
 editors.push({editor,panel});return {editor,panel,view:editor.prosemirrorView};
}
afterEach(()=>{for(const {editor,panel} of editors){editor._tiptapEditor.destroy();panel.remove()}editors=[];vi.restoreAllMocks();vi.unstubAllGlobals()});
const paragraph=(id,content=id)=>({id,type:'paragraph',content});
const columns=()=>[{id:'columns',type:'columnList',children:[{id:'left',type:'column',children:[paragraph('a'),paragraph('b'),paragraph('c')]},{id:'right',type:'column',children:[paragraph('d'),paragraph('e'),paragraph('f')]}]}];
function geometry({view,panel},boxes){
 const box=(left,top,right,bottom)=>({left,top,right,bottom,x:left,y:top,width:right-left,height:bottom-top});
 panel.getBoundingClientRect=()=>box(0,0,600,600);view.dom.getBoundingClientRect=()=>box(40,40,560,500);
 for(const [id,coords] of Object.entries(boxes)){
   const outer=panel.querySelector(`.bn-block-outer[data-id="${id}"]`),content=outer.querySelector('.bn-block-content');
   outer.getBoundingClientRect=content.getBoundingClientRect=()=>box(...coords);
   content.getClientRects=()=>coords[2]>coords[0]?[box(...coords)]:[];
 }
}
function pointer(target,type,x,y,extra={}){
 const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y,...extra});
 Object.defineProperties(event,{pointerId:{value:1},pointerType:{value:'mouse'}});target.dispatchEvent(event);return event;
}
function marquee(panel,from,to){pointer(panel,'pointerdown',...from);pointer(document,'pointermove',...to);pointer(document,'pointerup',...to)}
function key(view,value,extra={}){view.dom.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extra}))}
function clipboard(view,type){const data=new Map(),event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{clearData:()=>data.clear(),setData:(key,value)=>data.set(key,value),getData:key=>data.get(key)||'',types:[]}});view.dom.dispatchEvent(event);return data}

describe('marquee gesture through editor pointer events',()=>{
 it('selects full blocks forward or backward without changing the document',()=>{
   const context=create([paragraph('a'),paragraph('b'),paragraph('c')]);
   geometry(context,{a:[40,50,560,80],b:[40,90,560,120],c:[40,130,560,160]});
   const original=context.editor.document;
   marquee(context.panel,[580,45],[30,125]);expect(selectedBlockIds(context.editor)).toEqual(['a','b']);
   expect(context.panel.querySelectorAll('[data-block-range-selected]').length).toBe(2);
   marquee(context.panel,[30,125],[580,45]);expect(selectedBlockIds(context.editor)).toEqual(['a','b']);
   expect(context.editor.document).toEqual(original);expect(document.querySelector('.block-selection-marquee')).toBeNull();
 });
 it('selects only hit rows in one or both columns, not intervening document order',()=>{
   const context=create(columns());geometry(context,{a:[40,50,270,80],b:[40,90,270,120],c:[40,130,270,160],d:[320,50,560,80],e:[320,90,560,120],f:[320,130,560,160]});
   marquee(context.panel,[580,85],[30,125]);expect(selectedBlockIds(context.editor)).toEqual(['b','e']);
   marquee(context.panel,[290,45],[30,125]);expect(selectedBlockIds(context.editor)).toEqual(['a','b']);
 });
 it('also selects by dragging straight down in either page margin',()=>{
   const context=create([paragraph('a'),paragraph('b'),paragraph('c')]);geometry(context,{a:[40,50,560,80],b:[40,90,560,120],c:[40,130,560,160]});
   marquee(context.panel,[15,45],[15,125]);expect(selectedBlockIds(context.editor)).toEqual(['a','b']);
   marquee(context.panel,[585,85],[585,165]);expect(selectedBlockIds(context.editor)).toEqual(['b','c']);
 });
 it('does not select a parent just because a child intersects the rectangle',()=>{
   const context=create([{...paragraph('a'),children:[paragraph('b')]},paragraph('c')]);geometry(context,{a:[40,50,560,80],b:[70,90,560,120],c:[40,130,560,160]});
   marquee(context.panel,[580,85],[60,125]);expect(selectedBlockIds(context.editor)).toEqual(['b']);
   marquee(context.panel,[580,45],[30,125]);expect(selectedBlockIds(context.editor)).toEqual(['a']);
 });
 it('excludes hidden blocks, and can include an image as a whole block',()=>{
   const context=create([paragraph('a'),{id:'image',type:'image',props:{url:'data:image/png;base64,YQ=='}},paragraph('hidden')]);geometry(context,{a:[40,50,560,80],image:[40,90,560,200],hidden:[0,0,0,0]});
   marquee(context.panel,[580,45],[30,220]);expect(selectedBlockIds(context.editor)).toEqual(['a','image']);
 });
 it('leaves a drag that begins on text to the native text selection',()=>{
   const context=create([paragraph('a'),paragraph('b')]);geometry(context,{a:[40,50,560,80],b:[40,90,560,120]});
   vi.spyOn(Range.prototype,'getClientRects').mockReturnValue([{left:42,top:52,right:80,bottom:76}]);
   const content=context.panel.querySelector('p');expect(pointer(content,'pointerdown',50,60).defaultPrevented).toBe(false);
   pointer(document,'pointermove',200,110);pointer(document,'pointerup',200,110);expect(selectedBlockIds(context.editor)).toEqual([]);
 });
 it('supports fast release, Shift to add, and Escape to cancel a gesture',()=>{
   const context=create([paragraph('a'),paragraph('b')]);geometry(context,{a:[40,50,560,80],b:[40,90,560,120]});
   pointer(context.panel,'pointerdown',580,45);pointer(document,'pointerup',30,85);expect(selectedBlockIds(context.editor)).toEqual(['a']);
   pointer(context.panel,'pointerdown',580,85,{shiftKey:true});pointer(document,'pointerup',30,125);expect(selectedBlockIds(context.editor)).toEqual(['a','b']);
   pointer(context.panel,'pointerdown',580,85);pointer(document,'pointermove',30,125);expect(selectedBlockIds(context.editor)).toEqual(['b']);
   key(context.view,'Escape');expect(selectedBlockIds(context.editor)).toEqual(['a','b']);expect(document.querySelector('.block-selection-marquee')).toBeNull();
   key(context.view,'Escape');expect(selectedBlockIds(context.editor)).toEqual([]);
 });
 it('scrolls the editing pane at the edge and stops scrolling on release',()=>{
   let tick;const request=vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{tick=callback;return 1});
   const cancel=vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
   const context=create([paragraph('a'),paragraph('b')]);geometry(context,{a:[40,50,560,80],b:[40,90,560,120]});
   pointer(context.panel,'pointerdown',585,45);pointer(document,'pointermove',585,598);tick();
   expect(context.panel.scrollTop).toBeGreaterThan(0);
   pointer(document,'pointerup',585,598);const top=context.panel.scrollTop;tick();expect(context.panel.scrollTop).toBe(top);expect(cancel).toHaveBeenCalled();expect(document.querySelector('.block-selection-marquee')).toBeNull();
 });
 it('preserves media/table interaction and does not start while editing is locked',()=>{
   const context=create([{id:'image',type:'image',props:{url:'https://example.com/photo.png'}},paragraph('b')]);geometry(context,{image:[40,50,560,200],b:[40,210,560,240]});
   const image=context.panel.querySelector('img');expect(pointer(image,'pointerdown',100,100).defaultPrevented).toBe(false);
   context.editor.isEditable=false;marquee(context.panel,[585,45],[20,245]);expect(selectedBlockIds(context.editor)).toEqual([]);
 });
});

describe('selected block commands and history',()=>{
 it('copies only selected roots, including descendants, images and rich formatting',()=>{
   const {editor,view}=create([{...paragraph('a'),children:[paragraph('child')]},{id:'image',type:'image',props:{url:'https://example.com/photo.png'}},paragraph('keep')]);
   selectBlocks(editor,['a','child','image']);const data=clipboard(view,'copy');
   expect(data.get('text/plain')).toContain('child');expect(data.get('text/html')).toContain('photo.png');expect(data.get('text/plain')).not.toContain('keep');expect(editor.document).toHaveLength(3);
 });
 it('copies and deletes non-contiguous rows across columns and restores the exact layout with undo',()=>{
   const {editor,view}=create(columns()),original=editor.document;
   selectBlocks(editor,['b','e']);const data=clipboard(view,'copy');expect(data.get('text/plain').trim()).toBe('b\n\ne');
   key(view,'Backspace');expect(editor.getBlock('b')).toBeUndefined();expect(editor.getBlock('e')).toBeUndefined();expect(editor.getBlock('c')).toBeDefined();expect(editor.getBlock('d')).toBeDefined();
   editor.undo();expect(editor.document).toEqual(original);expect(selectedBlockIds(editor)).toEqual(['b','e']);
 });
 it('cuts only chosen blocks in different columns and undoes in one step',()=>{
   const {editor,view}=create(columns()),original=editor.document;
   selectBlocks(editor,['b','e']);const data=clipboard(view,'cut');expect(data.get('text/plain')).toContain('b');
   expect(editor.getBlock('b')).toBeUndefined();expect(editor.getBlock('e')).toBeUndefined();expect(editor.getBlock('c')).toBeDefined();
   editor.undo();expect(editor.document).toEqual(original);
 });
 it('replaces only the selected ranges when pasting or typing',()=>{
   vi.stubGlobal('ClipboardEvent',class extends Event {});
   const {editor,view}=create(columns());selectBlocks(editor,['b','e']);editor.pasteText('replacement');
   expect(editor.getBlock('b')).toBeUndefined();expect(editor.getBlock('e')).toBeUndefined();expect(editor.getBlock('c')).toBeDefined();expect(editor.getBlock('d')).toBeDefined();expect(view.state.doc.textContent).toContain('replacement');
   editor.undo();selectBlocks(editor,['b','e']);view.dispatch(view.state.tr.insertText('typed'));
   expect(editor.getBlock('b')).toBeUndefined();expect(editor.getBlock('e')).toBeUndefined();expect(editor.getBlock('c')).toBeDefined();expect(editor.getBlock('d')).toBeDefined();expect(view.state.doc.textContent).toContain('typed');
 });
 it('duplicates a single block or a rectangular selection within its original columns',()=>{
   const {editor}=create(columns());selectBlocks(editor,['b','e']);duplicate(editor);
   const row=editor.document[0];expect(row.children[0].children.map(b=>b.content[0].text)).toEqual(['a','b','b','c']);expect(row.children[1].children.map(b=>b.content[0].text)).toEqual(['d','e','e','f']);expect(selectedBlockIds(editor)).toHaveLength(2);
   editor.undo();selectBlocks(editor,['a']);duplicate(editor);expect(selectedBlockIds(editor)).toHaveLength(1);
 });
 it('can delete the entire document and type into a valid empty block afterward',()=>{
   const {editor,view}=create([paragraph('a'),paragraph('b')]);selectBlocks(editor,['a','b']);key(view,'Delete');expect(editor.document).toHaveLength(1);expect(editor.document[0].content).toEqual([]);
   editor.undo();expect(editor.getBlock('a')).toBeDefined();expect(editor.getBlock('b')).toBeDefined();
 });
 it('serializes and maps block selections without including unselected siblings',()=>{
   const {editor,view}=create(columns());selectBlocks(editor,['b','e']);const selection=view.state.selection;
   expect(Selection.fromJSON(view.state.doc,selection.toJSON()).eq(selection)).toBe(true);
   editor.updateBlock('a',{content:'longer before selection'});expect(selectedBlockIds(editor)).toEqual(['b','e']);expect(view.state.selection.content().content.childCount).toBe(2);
 });
 it('prints no block-selection highlight and does not modify the live selection',()=>{
   const {editor,panel}=create([paragraph('a'),paragraph('b')]);selectBlocks(editor,['a','b']);expect(panel.querySelector('[data-block-range-selected]')).not.toBeNull();
   const html=capturePaperSource(panel,{font:'default',title:''});expect(html).not.toContain('data-block-range-selected');expect(selectedBlockIds(editor)).toEqual(['a','b']);
 });
});
