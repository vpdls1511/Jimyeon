import {afterEach,describe,expect,it} from 'vitest';
import {BlockNoteEditor} from '@blocknote/core';
import {schema} from '../src/blocks';
import {commitColumnWidths,resizedPair,snapColumnDelta} from '../src/column-resize';
import {blockSelection,selectedBlockIds} from '../src/block-selection';
import {saveDocument,loadDocument,emptyDocument} from '../src/storage';
const editors=[];
const paragraph=(id,text)=>({id,type:'paragraph',content:text});
const cell=(id,width,children)=>({id,type:'column',props:{width},children});
function create(){
 const inner={id:'inner',type:'columnList',children:[cell('a',1,[paragraph('a-text','A')]),cell('b',1,[paragraph('b-text','B')]),cell('c',1,[paragraph('c-text','C')]),cell('d',1,[paragraph('d-text','D')])]};
 const e=BlockNoteEditor.create({schema,initialContent:[{id:'outer',type:'columnList',children:[cell('photo',.4,[paragraph('portrait','photo')]),cell('body',1.6,[paragraph('contact','Contact.'),inner])]}],extensions:[blockSelection()]});
 const panel=document.createElement('section');panel.className='editing-panel';const root=document.createElement('div');panel.append(root);document.body.append(panel);e.mount(root);editors.push(e);return {e,panel};
}
afterEach(()=>{for(const e of editors)e._tiptapEditor.destroy();editors.length=0;document.body.replaceChildren()});
describe('adjacent column resizing',()=>{
 it('snaps both drag directions to document-based 10px steps',()=>{
  expect(snapColumnDelta(4,200,200)).toBe(0);expect(snapColumnDelta(-4,200,200)).toBe(0);
  expect(snapColumnDelta(5,200,200)).toBe(10);expect(snapColumnDelta(-5,200,200)).toBe(-10);
  expect(snapColumnDelta(16,200,200)).toBe(20);expect(snapColumnDelta(-16,200,200)).toBe(-20);
  expect(snapColumnDelta(12,150,150,.75)).toBe(15);
 });
 it('limits whole steps before minimum widths and does not jump in narrow imported columns',()=>{
  expect(snapColumnDelta(10000,200,200)).toBe(150);expect(snapColumnDelta(-10000,200,200)).toBe(-150);
  expect(snapColumnDelta(10,200,55)).toBe(0);expect(snapColumnDelta(0,20,100)).toBe(0);expect(snapColumnDelta(10,20,100)).toBe(0);expect(snapColumnDelta(30,20,100)).toBe(30);
  expect(snapColumnDelta(10,20,30)).toBe(0);
 });
 it('preserves the pair sum and follows measured pointer distance',()=>{expect(resizedPair(1,1,200,200,50)).toEqual({left:1.25,right:.75});expect(resizedPair(.4,1.6,80,320,40)).toEqual({left:.6,right:1.4})});
 it('behaves identically at different editor zooms and limits only the affected pair',()=>{const expected=resizedPair(1,1,200,200,50);expect(resizedPair(1,1,100,100,25,24)).toEqual(expected);const clamped=resizedPair(1,1,200,200,10000);expect(clamped.left+clamped.right).toBe(2);expect(clamped.right*200).toBeCloseTo(48)});
 it('updates only the two adjacent inner columns and undoes a resize in one step',()=>{
  const {e}=create(),before=e.document;expect(commitColumnWidths(e,'b','c',{left:1.3,right:.7})).toBe(true);
  expect(e.getBlock('inner').children.map(c=>c.props.width)).toEqual([1,1.3,.7,1]);expect(e.getBlock('outer').children.map(c=>c.props.width)).toEqual([.4,1.6]);expect(e.getBlock('contact')).toEqual(before[0].children[1].children[0]);
  e.undo();expect(e.document).toEqual(before);e.redo();expect(e.getBlock('b').props.width).toBe(1.3);
 });
 it('rejects nonadjacent/cross-row pairs, changed totals, and locked documents',()=>{const {e}=create(),before=e.document;expect(commitColumnWidths(e,'a','c',{left:1.3,right:.7})).toBe(false);expect(commitColumnWidths(e,'photo','a',{left:.5,right:.9})).toBe(false);expect(commitColumnWidths(e,'b','c',{left:1.3,right:1})).toBe(false);e.isEditable=false;expect(commitColumnWidths(e,'b','c',{left:1.3,right:.7})).toBe(false);expect(e.document).toEqual(before)});
 it('saves and reloads the exact resized ratios',async()=>{const {e}=create();commitColumnWidths(e,'b','c',{left:1.3,right:.7});await saveDocument({...emptyDocument(),blocks:e.document});expect((await loadDocument()).blocks).toEqual(e.document)});

 async function handleFixture(){
  const result=create(),{e,panel}=result,view=e.prosemirrorView;
  const root=view.dom.parentElement;root.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:800,bottom:300,width:800,height:300});
  for(const list of view.dom.querySelectorAll('.bn-block-column-list'))list.getClientRects=()=>[list.getBoundingClientRect()];
  for(const [i,id] of ['a','b','c','d'].entries()){
   const element=view.dom.querySelector(`[data-node-type="column"][data-id="${id}"]`);
   element.getBoundingClientRect=()=>({left:i*200,right:(i+1)*200,top:40,bottom:140,width:200,height:100});
  }
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const handle=panel.querySelector('[data-left-column="b"][data-right-column="c"]');expect(handle).not.toBeNull();
  return {...result,handle};
 }
 function pointer(target,type,x){const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:60,button:0});Object.defineProperty(event,'pointerId',{value:1});Object.defineProperty(event,'pointerType',{value:'mouse'});target.dispatchEvent(event)}
 it('previews a separator drag without selecting blocks, then commits once',async()=>{
  const {e,panel,handle}=await handleFixture(),before=e.document;
  pointer(handle,'pointerdown',400);pointer(document,'pointermove',450);expect(e.document).toEqual(before);expect(selectedBlockIds(e)).toEqual([]);expect(panel.classList.contains('resizing-columns')).toBe(true);expect(panel.classList.contains('selecting-blocks')).toBe(false);
  pointer(document,'pointerup',450);expect(e.getBlock('inner').children.map(c=>c.props.width)).toEqual([1,1.25,.75,1]);expect(panel.classList.contains('resizing-columns')).toBe(false);e.undo();expect(e.document).toEqual(before);
 });
 it('cancels the live preview on Escape without editing or adding an undo step',async()=>{
  const {e,panel,handle}=await handleFixture(),before=e.document;pointer(handle,'pointerdown',400);pointer(document,'pointermove',450);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  expect(e.document).toEqual(before);expect(panel.classList.contains('resizing-columns')).toBe(false);expect(e.prosemirrorView.dom.querySelector('[data-node-type="column"][data-id="b"]').style.flexGrow).toBe('1');
 });
 it('does not change saved ratios when a separator is clicked without moving',async()=>{
  const {e,handle}=await handleFixture();commitColumnWidths(e,'b','c',{left:1.3,right:.7});const before=e.document;
  pointer(handle,'pointerdown',400);pointer(document,'pointerup',400);expect(e.document).toEqual(before);
 });
 it('commits a snapped drag, leaves other columns fixed and ignores sub-step movement',async()=>{
  const {e,handle}=await handleFixture(),before=e.document;
  pointer(handle,'pointerdown',400);pointer(document,'pointerup',404);expect(e.document).toEqual(before);
  pointer(handle,'pointerdown',400);pointer(document,'pointermove',416);pointer(document,'pointerup',416);
  const widths=e.getBlock('inner').children.map(c=>c.props.width);expect(widths[0]).toBe(1);expect(widths[1]).toBeCloseTo(1.1);expect(widths[2]).toBeCloseTo(.9);expect(widths[3]).toBe(1);e.undo();expect(e.document).toEqual(before);
 });
 it('uses the same 10px step for keyboard adjustment, including Shift',async()=>{
  const {e,handle}=await handleFixture();handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true,cancelable:true}));expect(e.getBlock('b').props.width).toBe(1.05);expect(e.getBlock('c').props.width).toBeCloseTo(.95);
 });
});
