import {act} from 'react';
import {expect,it} from 'vitest';
import {emptyDocument,saveDocument} from '../src/storage';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const root=document.createElement('div');root.id='root';document.body.append(root);
await saveDocument({...emptyDocument(),blocks:[{id:'a',type:'paragraph',content:'cat cat cat'},{id:'b',type:'paragraph',content:'cat dog cat'}]});
await act(async()=>{await import('../src/main')});
const text=id=>document.querySelector(`[data-id="${id}"] .bn-inline-content`).textContent;
const matches=()=>document.querySelectorAll('.find-match').length;
const counter=()=>document.querySelector('.find-panel span').textContent;
const button=name=>[...document.querySelectorAll('.find-panel button')].find(b=>b.textContent===name||b.title===name);
const type=async(input,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})};
const click=async el=>{await act(async()=>el.click())};
it('keeps the current match after replacing so the counter and the replaced item agree',async()=>{
 await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true}))});
 await type(document.querySelector('input[aria-label="찾을 내용"]'),'cat');await type(document.querySelector('input[aria-label="바꿀 내용"]'),'dog');
 expect(counter()).toBe('1/5');
 await click(button('다음 결과'));expect(counter()).toBe('2/5');
 await click(button('바꾸기'));await click(button('바꾸기'));
 expect(text('a')).toBe('cat dog dog');expect(counter()).toBe('2/3');
 expect(document.querySelectorAll('.find-match')).toHaveLength(3);expect(document.querySelectorAll('.find-match.active')).toHaveLength(1);
});
it('does not bring highlights back when the document is edited after the panel is closed',async()=>{
 await click(button('닫기'));expect(matches()).toBe(0);
 const view=document.querySelector('.ProseMirror').editor.view;
 await act(async()=>{view.dispatch(view.state.tr.insertText('x',1))});
 expect(matches()).toBe(0);
});
