import {act} from 'react';
import {beforeAll,expect,it,vi} from 'vitest';
import {saveDocument,emptyDocument} from '../src/storage';
import {replaceSearch} from '../src/search';
import {undo,redo,closeHistory} from '@tiptap/pm/history';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const cover='data:image/png;base64,iVBORw0KGgo=';
const tiptap=()=>document.querySelector('.ProseMirror').editor,doc=()=>tiptap().state.doc.toJSON();
const node=id=>{let found;tiptap().state.doc.descendants(n=>{if(n.attrs.id===id)found=n});return found};
const props=id=>node(id).firstChild.attrs;
const text=id=>node(id).firstChild.textContent;
const click=el=>act(async()=>el.click());
const dblclick=el=>act(async()=>{el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))});
const key=(el,name)=>act(async()=>{el.dispatchEvent(new KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true}))});
const type=(el,value)=>act(async()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))});
const button=(label,root=document)=>[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===label||b.title===label||b.getAttribute('aria-label')===label);
async function menu(label){await click(document.querySelector('[aria-label="문서 메뉴"]'));await click([...document.querySelectorAll('.document-menu button')].find(b=>b.textContent.includes(label)))}
beforeAll(async()=>{
 await saveDocument({...emptyDocument(),title:'잠긴 문서',locked:true,icon:'💡',cover,blocks:[
  {id:'a',type:'paragraph',content:'cat cat'},
  {id:'c',type:'callout',props:{icon:'💡'},content:'메모'},
  {id:'e',type:'equation',props:{expression:'x^2'}},
  {id:'i',type:'paragraph',content:['식 ',{type:'inlineEquation',props:{expression:'a+b'}}]},
  {id:'w',type:'bookmark',props:{url:'https://example.com/'}},
  {id:'b',type:'button',props:{label:'버튼',action:'text',value:'삽입된 문단'}},
  {id:'t',type:'tabs',children:[{id:'p1',type:'tabPanel',props:{label:'탭 1'},children:[{type:'paragraph',content:'첫 탭'}]},{id:'p2',type:'tabPanel',props:{label:'탭 2'},children:[{type:'paragraph',content:'둘째 탭'}]}]},
 ]});
 const root=document.createElement('div');root.id='root';document.body.append(root);
 await act(async()=>{await import('../src/main.jsx')});await vi.waitFor(()=>expect(document.querySelector('.locked-note')).not.toBeNull());
},30000);

it('keeps the body through undo, redo and replace while locked, and find still works',async()=>{
 await menu('편집 잠금 해제');
 // Two history steps with the second undone, so both undo and redo have something to apply once locked.
 await act(async()=>{const t=tiptap(),end=node('a').firstChild;let pos;t.state.doc.descendants((n,p)=>{if(n===end)pos=p+n.nodeSize-1});t.view.dispatch(t.state.tr.insertText('!',pos));t.view.dispatch(closeHistory(t.state.tr.insertText('?',pos+1)));undo(t.state,t.view.dispatch)});
 expect(text('a')).toBe('cat cat!');await menu('문서 잠금');const before=doc();
 for(const command of [undo,redo]){await act(async()=>{command(tiptap().state,tiptap().view.dispatch)});expect(doc()).toEqual(before)}
 await click(button('찾기 및 바꾸기'));await type(document.querySelector('input[aria-label="찾을 내용"]'),'cat');
 expect(document.querySelectorAll('.find-match')).toHaveLength(2);await click(button('다음 결과'));expect(document.querySelector('.find-panel span').textContent).toBe('2/2');
 await type(document.querySelector('input[aria-label="바꿀 내용"]'),'dog');
 await act(async()=>replaceSearch({_tiptapEditor:tiptap()},'dog',true));expect(doc()).toEqual(before);
 for(const label of ['되돌리기','다시 실행','바꾸기','모두'])expect(button(label).disabled).toBe(true);
 await click(button('닫기'));
});

it('keeps blocks unchanged when their controls are used while locked, while tabs can still be switched',async()=>{
 const before=doc();
 // The forms still open here because CSS is not applied in tests, so the guard itself must keep the document.
 await click(document.querySelector('.callout-icon'));await click(button('📌',document.querySelector('.emoji-popover')));
 await click(document.querySelector('.math-button'));const area=document.querySelector('textarea[aria-label="LaTeX 수식"]');
 await type(area,'y^3');await act(async()=>{area.form.requestSubmit()});
 await dblclick(document.querySelector('.inline-equation'));const inline=document.querySelector('input[aria-label="LaTeX 수식"]');
 await type(inline,'c');await key(inline,'Enter');
 await click(button('링크 편집'));const address=document.querySelector('input[aria-label="웹 주소"]');
 await type(address,'https://changed.example/');await act(async()=>{address.form.requestSubmit()});
 await click(button('버튼 ↗'));await click(button('버튼 설정'));const name=document.querySelector('.button-settings input');
 await type(name,'바뀐 버튼');
 await click(button('탭 추가'));await dblclick(button('탭 1'));const label=document.querySelector('input[aria-label="탭 이름"]');
 if(label){await type(label,'바뀐 탭');await key(label,'Enter')}
 expect(props('c').icon).toBe('💡');expect(props('e').expression).toBe('x^2');expect(props('w').url).toBe('https://example.com/');
 expect(props('b').label).toBe('버튼');expect(doc()).toEqual(before);
 // Edit-only inputs stay closed; switching tabs is reading, so it still works.
 expect(label).toBeNull();await click(button('탭 2'));expect(button('탭 2').className).toBe('active');
});

it('keeps the document icon and cover while locked',async()=>{
 await click(document.querySelector('.page-icon'));expect(document.querySelector('.page-emoji')).toBeNull();
 expect(document.querySelector('.page-tools')).toBeNull();expect(document.querySelector('.cover-actions')).toBeNull();
 expect(document.querySelector('.cover img').getAttribute('src')).toBe(cover);expect(document.querySelector('.page-icon').textContent).toBe('💡');
});

// Replaces the shared document, so it runs last.
it('still offers saving and PDF export and switches to a new document while locked',async()=>{
 expect(document.querySelector('#export-pdf').disabled).toBe(false);expect(button('문서 저장').disabled).toBe(false);await click(button('문서 저장'));expect(document.querySelector('[role="dialog"]')).not.toBeNull();await click(button('취소'));
 await menu('새 문서');
 await vi.waitFor(()=>expect(document.querySelector('.locked-note')).toBeNull());expect(tiptap().state.doc.textContent).toBe('');expect(document.querySelector('#document-title').value).toBe('');
});
