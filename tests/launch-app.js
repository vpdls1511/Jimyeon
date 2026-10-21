import {act} from 'react';
import {afterAll,expect,vi} from 'vitest';
const {roots}=vi.hoisted(()=>({roots:new Set()}));
vi.mock('react-dom/client',async importOriginal=>{const actual=await importOriginal();return {...actual,createRoot:(...args)=>{const root=actual.createRoot(...args);roots.add(root);return root}}});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// Track the App's timers so tests can wait for its pending work and nothing runs after jsdom is torn down.
const timers=new Map(),pending=new Set(),{setTimeout:schedule,clearTimeout:cancel}=globalThis;
vi.stubGlobal('setTimeout',(run,delay,...args)=>{const id=schedule(()=>{timers.delete(id);const result=run(...args);if((delay||0)<1000&&result&&typeof result.then==='function'){pending.add(result);Promise.resolve(result).then(()=>pending.delete(result),()=>pending.delete(result))}},delay);timers.set(id,delay||0);return id});
vi.stubGlobal('clearTimeout',id=>{timers.delete(id);cancel(id)});
// Short timers are the autosave debounce and page layout. Toast and font fallback timers run for seconds and never change the document.
export const settle=()=>vi.waitFor(()=>{expect([...timers.values()].filter(delay=>delay<1000)).toEqual([]);expect(pending.size).toBe(0)},{timeout:10000});
afterAll(async()=>{try{await act(()=>settle())}finally{try{await act(()=>{roots.forEach(root=>root.unmount());roots.clear()})}finally{timers.forEach((_,id)=>cancel(id));timers.clear()}}});
// main.jsx renders on import, so a test file can launch the real App only once.
// The first document is written with the real storage so a mocked saveDocument only records the App's own saves.
export async function launchApp(doc){
 if(doc)await (await vi.importActual('../src/storage')).saveDocument(doc);
 document.body.innerHTML='<div id="root"></div>';
 await act(async()=>{await import('../src/main.jsx')});
 await vi.waitFor(()=>expect(document.querySelector('.ProseMirror')).not.toBeNull());await settle();
}
// jsdom's File has no text(), so pass the part of File that openFile reads.
export function chooseFile(name,text){const input=document.querySelector('input[type="file"][accept*=".jimyeon"]');Object.defineProperty(input,'files',{configurable:true,value:[{name,text:async()=>text}]});input.dispatchEvent(new Event('change',{bubbles:true}))}
export const importDocument=doc=>chooseFile('복구.jimyeon',JSON.stringify(doc));
