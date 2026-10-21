import {act} from 'react';
import {afterEach,beforeAll,describe,expect,it,vi} from 'vitest';
import {openDB} from 'idb';
import {saveDocument,emptyDocument} from '../src/storage';
import {launchApp,settle} from './launch-app';
vi.mock('../src/storage',async importOriginal=>{const actual=await importOriginal();return {...actual,saveDocument:vi.fn(actual.saveDocument)}});
const doc=text=>({...emptyDocument(),title:'계약서',blocks:[{type:'paragraph',content:[{type:'text',text,styles:{}}]}]});
const view=()=>document.querySelector('.ProseMirror'),body=()=>view().textContent;
const text=saved=>saved.blocks.map(b=>(b.content||[]).map(c=>c.text).join('')).join('\n');
const stored=async()=>{const db=await openDB('jimyeon',1);try{return await db.get('documents','current')}finally{db.close()}};
// Another tab writes through its own connection, exactly like a second editor instance.
const saveFromOtherTab=async value=>{const db=await openDB('jimyeon',1);try{await db.put('documents',value,'current')}finally{db.close()}};
function hide(){Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden}
function edit(value){const tiptap=view().editor;let pos;tiptap.state.doc.descendants((node,p)=>{if(pos===undefined&&node.isText)pos=p});tiptap.view.dispatch(tiptap.state.tr.insertText(value,pos))}
beforeAll(()=>launchApp(doc('초안')),30000);
afterEach(()=>saveDocument.mockClear());
it('does not write the loaded document back on startup, so a save from another tab right after loading survives',async()=>{
 await saveFromOtherTab(doc('다른 탭에서 방금 저장한 내용'));
 await settle();expect(saveDocument).not.toHaveBeenCalled();expect(text(await stored())).toBe('다른 탭에서 방금 저장한 내용');
});
describe('autosave when a browser tab is hidden or closed',()=>{
 it('does not overwrite a newer document from another tab when this tab has no unsaved edits',async()=>{
  const newer=doc('초안 + 30분 동안 쓴 내용');await saveFromOtherTab(newer);
  act(()=>{hide();window.dispatchEvent(new Event('pagehide'))});
  await settle();expect(saveDocument).not.toHaveBeenCalled();expect(text(await stored())).toBe('초안 + 30분 동안 쓴 내용');
 });
 it('saves pending edits immediately on hide or close without saving them twice',async()=>{
  act(()=>{edit('수정 ');window.dispatchEvent(new Event('pagehide'))});
  expect(saveDocument).toHaveBeenCalledOnce();expect(text(saveDocument.mock.calls[0][0])).toBe('수정 초안');
  expect(saveDocument.mock.calls[0][0].format).toBe('jimyeon');
  act(()=>hide());await settle();expect(saveDocument).toHaveBeenCalledOnce();await vi.waitFor(async()=>expect(text(await stored())).toBe('수정 초안'));
 });
 it('retries edits whose autosave failed when the tab is hidden',async()=>{
  saveDocument.mockRejectedValueOnce(Error('저장 공간 부족'));
  act(()=>edit('다시 '));await settle();expect(saveDocument).toHaveBeenCalledOnce();
  act(()=>hide());expect(saveDocument).toHaveBeenCalledTimes(2);await vi.waitFor(async()=>expect(text(await stored())).toBe('다시 수정 초안'));
 });
 it('retries a failed hide save on the next hide',async()=>{
  saveDocument.mockRejectedValueOnce(Error('저장 공간 부족'));
  // Let the failed hide save settle so its catch handler has run before hiding again.
  act(()=>{edit('또 ');hide()});await saveDocument.mock.results[0].value.catch(()=>{});
  act(()=>hide());expect(saveDocument).toHaveBeenCalledTimes(2);await vi.waitFor(async()=>expect(text(await stored())).toBe('또 다시 수정 초안'));
 });
});
it('does not overwrite a newer document from another tab when this tab saves a document file',async()=>{
 await saveFromOtherTab(doc('다른 탭에서 쓴 최신 내용'));
 URL.createObjectURL=vi.fn(()=>'blob:document');URL.revokeObjectURL=()=>{};
 try{
  await act(async()=>document.querySelector('#save-json').click());
  await act(async()=>document.querySelector('form[aria-labelledby="save-document-title"]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await vi.waitFor(()=>expect(URL.createObjectURL).toHaveBeenCalledOnce());
  await settle();expect(saveDocument).not.toHaveBeenCalled();expect(text(await stored())).toBe('다른 탭에서 쓴 최신 내용');
 }finally{delete URL.createObjectURL;delete URL.revokeObjectURL}
});
