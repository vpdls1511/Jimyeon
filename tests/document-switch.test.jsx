import {act} from 'react';
import {beforeAll,describe,expect,it,vi} from 'vitest';
import {openDB} from 'idb';
import {emptyDocument} from '../src/storage';
import {launchApp,settle,chooseFile} from './launch-app';
const doc=(title,content,extra={})=>({...emptyDocument(),...extra,title,blocks:[{type:'paragraph',content}]});
const view=()=>document.querySelector('.ProseMirror'),body=()=>view().textContent,title=()=>document.querySelector('#document-title').value;
const stored=async()=>{const db=await openDB('local-notion-editor',1);try{return await db.get('documents','current')}finally{db.close()}};
const savedText=saved=>saved.blocks.map(b=>(b.content||[]).map(c=>c.text).join('')).join('\n');
async function undo(){await act(async()=>{view().dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}))})}
async function menu(label){await act(async()=>document.querySelector('[aria-label="문서 메뉴"]').click());await act(async()=>[...document.querySelectorAll('.document-menu button')].find(b=>b.textContent.includes(label)).click())}
const importFile=(name,text)=>act(async()=>chooseFile(name,text));
// Each import uses a new title so waiting for it proves the switch finished.
async function importDocument(value){
 await importFile(value.title+'.jimyeon',JSON.stringify(value));
 await vi.waitFor(()=>expect(title()).toBe(value.title));expect(body()).toBe(value.blocks[0].content);
}
async function expectAfterUndo(expectedTitle,expectedBody){
 await undo();expect(body()).toBe(expectedBody);expect(title()).toBe(expectedTitle);
 await settle();const saved=await stored();expect(saved.title).toBe(expectedTitle);expect(savedText(saved)).toBe(expectedBody);
}
beforeAll(()=>launchApp(doc('A 기획서','A 본문',{paper:'A3'})),30000);
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
describe('importing other files',()=>{
 const blocks=()=>[...document.querySelectorAll('.bn-block-content')].map(el=>el.dataset.contentType+':'+el.textContent);
 const toast=()=>document.querySelector('.toast')?.textContent;
 it('keeps each line of a text file as a plain paragraph and names the document after the file',async()=>{
  await importDocument(doc('F 기획서','F 본문'));
  await importFile('메모.txt','장보기 목록\r\n우유\r\n계란\r\n\r\n# 3번 출구 앞에서 만나기\r\n*중요* 2*3=6\r\n');
  await vi.waitFor(()=>expect(title()).toBe('메모'));
  expect(blocks()).toEqual(['paragraph:장보기 목록','paragraph:우유','paragraph:계란','paragraph:','paragraph:# 3번 출구 앞에서 만나기','paragraph:*중요* 2*3=6']);
  expect(view().querySelector('em')).toBeNull();
 });
 it('names an imported HTML document after the file',async()=>{
  await importDocument(doc('G 기획서','G 본문'));
  await importFile('회의록.html','<h2>안건</h2><p>회의 본문</p>');
  // The body is replaced right away, but the title is React state that renders a moment later.
  await vi.waitFor(()=>{expect(body()).toBe('안건회의 본문');expect(title()).toBe('회의록')});
  await vi.waitFor(async()=>expect((await stored()).title).toBe('회의록'));
 });
 it('explains a truncated document file in Korean and keeps the current document',async()=>{
  await importDocument(doc('H 기획서','H 본문'));
  await importFile('잘린 문서.jimyeon',JSON.stringify(doc('I 이력서','I 본문')).slice(0,67));
  await vi.waitFor(()=>expect(toast()).toBe('문서 파일이 손상되었거나 형식이 올바르지 않습니다.'));
  expect(title()).toBe('H 기획서');expect(body()).toBe('H 본문');
 });
 it('keeps the editor on screen when a document file has non-text title or icon values',async()=>{
  await importDocument(doc('J 기획서','J 본문'));
  await importFile('외부 도구.jimyeon',JSON.stringify({...doc('','K 본문'),title:{ko:'이력서'},icon:{emoji:'📄'}}));
  await vi.waitFor(()=>{expect(body()).toBe('K 본문');expect(title()).toBe('')});
  expect(document.querySelector('.page-icon')).toBeNull();
  await vi.waitFor(async()=>expect((await stored())).toMatchObject({title:'',icon:''}));
 });
 it('starts md, html and text imports from new-document defaults while a document file keeps its own properties',async()=>{
  const decorated=title=>doc(title,'L 본문',{icon:'📄',cover:'data:image/png;base64,YQ==',locked:true,paper:'A3'});
  const locked=()=>document.querySelector('.locked-note'),icon=()=>document.querySelector('.page-icon'),cover=()=>document.querySelector('.cover');
  await importDocument(decorated('L 기획서'));expect(locked()).not.toBeNull();expect(icon()).not.toBeNull();expect(cover()).not.toBeNull();
  for(const [name,text,body] of [['새글.md','# 안녕','안녕'],['새글.html','<p>웹</p>','웹'],['새글.txt','글','글']]){
   await importDocument(decorated('L 기획서 '+name));
   await importFile(name,text);await vi.waitFor(()=>expect(title()).toBe('새글'));expect(view().textContent).toBe(body);
   expect(locked()).toBeNull();expect(icon()).toBeNull();expect(cover()).toBeNull();
   await vi.waitFor(async()=>expect(await stored()).toMatchObject({title:'새글',icon:'',cover:'',locked:false,paper:'A4'}));
  }
  await importDocument(decorated('M 기획서'));expect(locked()).not.toBeNull();expect(icon()).not.toBeNull();expect(cover()).not.toBeNull();
  await vi.waitFor(async()=>expect(await stored()).toMatchObject({title:'M 기획서',locked:true,icon:'📄',paper:'A3'}));
 });
});
