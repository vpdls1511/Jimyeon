import {act} from 'react';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// main.jsx renders on import, so keep the root to unmount the real App.
let root;
vi.mock('react-dom/client',async importOriginal=>{const actual=await importOriginal();return {...actual,createRoot:el=>(root=actual.createRoot(el))}});
const toast=()=>document.querySelector('.toast')?.textContent;
const open=(name,text,message)=>act(async()=>{const input=document.querySelector('input[type="file"][accept*=".jimyeon"]');Object.defineProperty(input,'files',{configurable:true,value:[{name,text:async()=>text}]});input.dispatchEvent(new Event('change',{bubbles:true}));for(let i=0;i<20&&toast()!==message;i++)await new Promise(r=>setImmediate(r))});
beforeAll(async()=>{
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
 vi.spyOn(globalThis,'setTimeout');
 document.body.innerHTML='<div id="root"></div>';
 await act(async()=>{await import('../src/main.jsx')});
 await vi.waitFor(()=>expect(document.querySelector('input[type="file"][accept*=".jimyeon"]')).toBeTruthy());
});
afterAll(()=>vi.useRealTimers());

it('keeps the latest toast for its full 4.5 seconds when toasts follow each other',async()=>{
 await open('잘못.json','{"x":1}','이 에디터에서 저장한 문서를 선택하세요.');
 expect(toast()).toBe('이 에디터에서 저장한 문서를 선택하세요.');
 await act(async()=>{vi.advanceTimersByTime(3500)});
 await open('문서.md','# 제목','문서를 열었습니다.');
 expect(toast()).toBe('문서를 열었습니다.');
 await act(async()=>{vi.advanceTimersByTime(4400)});
 expect(toast()).toBe('문서를 열었습니다.');
 await act(async()=>{vi.advanceTimersByTime(200)});
 expect(toast()).toBeUndefined();
});

it('cancels the pending toast timer when the app unmounts',async()=>{
 await open('문서.md','# 다시','문서를 열었습니다.');
 const toastTimers=setTimeout.mock.results.filter((r,i)=>setTimeout.mock.calls[i][1]===4500).map(r=>r.value),cleared=vi.spyOn(globalThis,'clearTimeout');
 await act(async()=>root.unmount());
 expect(cleared).toHaveBeenCalledWith(toastTimers.at(-1));
});
