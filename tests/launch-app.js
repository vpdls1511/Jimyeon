import {afterAll,vi} from 'vitest';
// The App keeps autosave, toast and pagination timers running; cancel them before jsdom is torn down.
const timers=new Set(),{setTimeout:schedule}=globalThis;
vi.stubGlobal('setTimeout',(run,delay,...args)=>{const id=schedule(()=>{timers.delete(id);run(...args)},delay);timers.add(id);return id});
afterAll(()=>timers.forEach(id=>clearTimeout(id)));
// main.jsx renders on import, so a test file can launch the real App only once.
export async function launchApp(){document.body.innerHTML='<div id="root"></div>';await import('../src/main.jsx')}
// jsdom's File has no text(), so pass the part of File that openFile reads.
export function importDocument(doc){const input=document.querySelector('input[type="file"][accept*=".jimyeon"]');Object.defineProperty(input,'files',{configurable:true,value:[{name:'복구.jimyeon',text:async()=>JSON.stringify(doc)}]});input.dispatchEvent(new Event('change',{bubbles:true}))}
