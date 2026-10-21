import {act} from 'react';
import {afterEach,beforeAll,expect,it,vi} from 'vitest';
import {emptyDocument,saveDocument} from '../src/storage';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const dialog=()=>document.querySelector('[role="dialog"][aria-labelledby="save-document-title"]');
async function pressSave(target,modifier){
 const event=new KeyboardEvent('keydown',{key:'s',[modifier]:true,bubbles:true,cancelable:true});
 await act(async()=>{target.dispatchEvent(event)});return event;
}
beforeAll(async()=>{
 await saveDocument({...emptyDocument(),title:'이력서',blocks:[{type:'paragraph',content:'본문'}]});
 const root=document.createElement('div');root.id='root';document.body.append(root);
 await act(async()=>{await import('../src/main.jsx')});await vi.waitFor(()=>expect(document.querySelector('.ProseMirror')?.textContent).toBe('본문'));
},30000);
afterEach(async()=>{const cancel=[...(dialog()?.querySelectorAll('button')||[])].find(b=>b.textContent==='취소');if(cancel)await act(async()=>cancel.click())});
it('opens the save dialog instead of the browser page save while the title has focus',async()=>{
 const title=document.querySelector('#document-title');title.focus();
 for(const modifier of ['metaKey','ctrlKey']){
  const event=await pressSave(title,modifier);
  expect(event.defaultPrevented).toBe(true);expect(dialog()).not.toBeNull();
  await act(async()=>[...dialog().querySelectorAll('button')].find(b=>b.textContent==='취소').click());expect(dialog()).toBeNull();
 }
});
it('opens the save dialog after a toolbar button was clicked',async()=>{
 const button=document.querySelector('[aria-label="찾기 및 바꾸기"]');button.focus();
 const event=await pressSave(button,'ctrlKey');
 expect(event.defaultPrevented).toBe(true);expect(dialog()).not.toBeNull();
});
it('still opens the save dialog from the document body',async()=>{
 const event=await pressSave(document.querySelector('.ProseMirror'),'ctrlKey');
 expect(event.defaultPrevented).toBe(true);expect(dialog()).not.toBeNull();
});
