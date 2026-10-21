import {act} from 'react';
import {beforeAll,describe,expect,it,vi} from 'vitest';
import {openDB} from 'idb';
import {saveDocument,emptyDocument} from '../src/storage';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const doc=(title,content,extra={})=>({...emptyDocument(),...extra,title,blocks:[{type:'paragraph',content}]});
const view=()=>document.querySelector('.ProseMirror'),body=()=>view().textContent,title=()=>document.querySelector('#document-title').value;
const wait=ms=>act(()=>new Promise(resolve=>setTimeout(resolve,ms)));
const stored=async()=>{const db=await openDB('local-notion-editor',1);try{return await db.get('documents','current')}finally{db.close()}};
const savedText=saved=>saved.blocks.map(b=>(b.content||[]).map(c=>c.text).join('')).join('\n');
async function undo(){await act(async()=>{view().dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}))})}
async function menu(label){await act(async()=>document.querySelector('[aria-label="문서 메뉴"]').click());await act(async()=>[...document.querySelectorAll('.document-menu button')].find(b=>b.textContent.includes(label)).click())}
// Each import uses a new title so waiting for it proves the switch finished.
async function importDocument(value){
 const input=document.querySelector('input[type="file"][accept*=".jimyeon"]');
 // jsdom File has no text(); openFile only reads the name and text.
 Object.defineProperty(input,'files',{configurable:true,value:[{name:value.title+'.jimyeon',text:async()=>JSON.stringify(value)}]});
 await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}))});
 await vi.waitFor(()=>expect(title()).toBe(value.title));expect(body()).toBe(value.blocks[0].content);
}
async function expectAfterUndo(expectedTitle,expectedBody){
 await undo();expect(body()).toBe(expectedBody);expect(title()).toBe(expectedTitle);
 await wait(400);const saved=await stored();expect(saved.title).toBe(expectedTitle);expect(savedText(saved)).toBe(expectedBody);
}
beforeAll(async()=>{
 await saveDocument(doc('A 기획서','A 본문',{paper:'A3'}));const root=document.createElement('div');root.id='root';document.body.append(root);
 await act(async()=>{await import('../src/main.jsx')});await vi.waitFor(()=>expect(body()).toBe('A 본문'));
},30000);
describe('switching documents starts a new undo history',()=>{
 it('keeps an imported document intact when undoing right after opening it, while later edits stay undoable',async()=>{
  await importDocument(doc('B 이력서','B 본문',{paper:'A4',marginLeft:25}));
  await expectAfterUndo('B 이력서','B 본문');expect(await stored()).toMatchObject({paper:'A4',marginLeft:25});
  const tiptap=view().editor;let pos;tiptap.state.doc.descendants((node,p)=>{if(pos===undefined&&node.isText)pos=p});
  await act(async()=>tiptap.view.dispatch(tiptap.state.tr.insertText('수정 ',pos)));expect(body()).toBe('수정 B 본문');
  await undo();expect(body()).toBe('B 본문');
  await expectAfterUndo('B 이력서','B 본문');
 });
 it('keeps a new document empty when undoing right after creating it',async()=>{
  await importDocument(doc('C 회의록','C 본문'));
  await menu('새 문서');await vi.waitFor(()=>expect(title()).toBe(''));expect(body()).toBe('');
  await expectAfterUndo('','');
 });
 it('keeps a restored revision intact when undoing right after restoring it',async()=>{
  await importDocument(doc('D 보고서','D 본문'));await importDocument(doc('E 메모','E 본문'));
  await menu('저장 기록');
  await act(async()=>[...document.querySelectorAll('.revision-list button')].find(b=>b.textContent.includes('D 보고서')).click());
  await vi.waitFor(()=>expect(title()).toBe('D 보고서'));expect(body()).toBe('D 본문');
  await expectAfterUndo('D 보고서','D 본문');
 });
});
