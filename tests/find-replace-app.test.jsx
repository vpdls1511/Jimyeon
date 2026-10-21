import {act} from 'react';
import {beforeEach,expect,it} from 'vitest';
import {emptyDocument,saveDocument} from '../src/storage';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const root=document.createElement('div');root.id='root';document.body.append(root);
await saveDocument({...emptyDocument(),blocks:[{id:'a',type:'paragraph',content:'cat cat cat'},{id:'b',type:'paragraph',content:'cat dog cat'}]});
await act(async()=>{await import('../src/main')});
const text=id=>document.querySelector(`[data-id="${id}"] .bn-inline-content`).textContent;
const matches=()=>document.querySelectorAll('.find-match').length;
const counter=()=>document.querySelector('.find-panel span').textContent;
const activeIndex=()=>[...document.querySelectorAll('.find-match')].findIndex(el=>el.classList.contains('active'));
const button=name=>[...document.querySelectorAll('.find-panel button')].find(b=>b.textContent===name||b.title===name);
const type=async(input,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})};
const click=async el=>{await act(async()=>el.click())};
const toggleFind=()=>click(document.querySelector('button[title="찾기 및 바꾸기"]'));
const openFind=async query=>{if(!document.querySelector('.find-panel'))await toggleFind();await type(document.querySelector('input[aria-label="찾을 내용"]'),query)};
beforeEach(async()=>{await openFind('');await type(document.querySelector('input[aria-label="바꿀 내용"]'),'');const aa=document.querySelector('input[title="대소문자 구분"]');if(aa.checked)await click(aa);await click(button('닫기'))});
it('does not bring highlights back when the document is edited after the panel is closed',async()=>{
 await openFind('cat');expect(matches()).toBe(5);
 await click(button('닫기'));expect(matches()).toBe(0);
 const view=document.querySelector('.ProseMirror').editor.view;
 await act(async()=>{view.dispatch(view.state.tr.insertText('x',view.state.doc.content.size-2))});
 expect(matches()).toBe(0);
});
it('resets the current match to the first one when the query or case option changes',async()=>{
 await openFind('cat');await click(button('다음 결과'));await click(button('다음 결과'));
 expect(counter()).toBe('3/5');expect(activeIndex()).toBe(2);
 await type(document.querySelector('input[aria-label="찾을 내용"]'),'ca');
 expect(counter()).toBe('1/5');expect(activeIndex()).toBe(0);
 await click(button('다음 결과'));expect(activeIndex()).toBe(1);
 await click(document.querySelector('input[title="대소문자 구분"]'));
 expect(counter()).toBe('1/5');expect(activeIndex()).toBe(0);
});
// Mutates the shared document, so it runs last.
it('keeps the current match after replacing so the counter and the replaced item agree',async()=>{
 await openFind('cat');await type(document.querySelector('input[aria-label="바꿀 내용"]'),'dog');
 expect(counter()).toBe('1/5');
 await click(button('다음 결과'));expect(counter()).toBe('2/5');
 await click(button('바꾸기'));await click(button('바꾸기'));
 expect(text('a')).toBe('cat dog dog');expect(counter()).toBe('2/3');
 expect(matches()).toBe(3);expect(activeIndex()).toBe(1);
});
