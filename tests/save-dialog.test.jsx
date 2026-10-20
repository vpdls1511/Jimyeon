import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {SaveDocumentDialog} from '../src/SaveDocumentDialog';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const roots=[];
afterEach(()=>{roots.splice(0).forEach(root=>act(()=>root.unmount()));document.body.replaceChildren()});
function mount(onSave=vi.fn().mockResolvedValue(true),onClose=vi.fn()){
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);roots.push(root);act(()=>root.render(<SaveDocumentDialog onSave={onSave} onClose={onClose}/>));return {container,onSave,onClose};
}
it('offers three formats and warns about Markdown layout loss before saving',async()=>{
 const {container,onSave,onClose}=mount(),select=container.querySelector('select');expect([...select.options].map(o=>o.value)).toEqual(['jimyeon','json','md']);expect(document.activeElement).toBe(select);
 act(()=>{select.value='md';select.dispatchEvent(new Event('change',{bubbles:true}))});expect(container.textContent).toContain('모두 보존하지 못합니다');
 await act(async()=>{container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});expect(onSave).toHaveBeenCalledWith('md');expect(onClose).toHaveBeenCalledOnce();
});
it('retains the format dialog after native cancellation or a save error',async()=>{
 const {container,onSave,onClose}=mount(vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(Error('저장 실패')));
 for(let i=0;i<2;i++)await act(async()=>{container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
 expect(onClose).not.toHaveBeenCalled();expect(container.querySelector('[role="alert"]').textContent).toBe('저장 실패');expect(onSave).toHaveBeenCalledTimes(2);
});
it('closes on Escape and returns focus when dismissed',()=>{
 const button=document.createElement('button');document.body.append(button);button.focus();const {container,onClose}=mount();
 act(()=>container.querySelector('select').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(onClose).toHaveBeenCalledOnce();act(()=>roots.pop().unmount());expect(document.activeElement).toBe(button);
});

it('prevents duplicate submissions and dismissal while a save is in flight',async()=>{
 let finish;const {container,onSave,onClose}=mount(vi.fn(()=>new Promise(resolve=>{finish=resolve})));
 const form=container.querySelector('form');
 act(()=>{for(let i=0;i<2;i++)form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))});
 expect(onSave).toHaveBeenCalledOnce();expect(onClose).not.toHaveBeenCalled();expect(container.querySelector('select').disabled).toBe(true);
 await act(async()=>finish(false));expect(container.querySelector('select').disabled).toBe(false);
});
