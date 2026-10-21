import {act} from 'react';
import {setTimeout as schedule,clearTimeout as cancel} from 'node:timers';
import {expect,it,vi} from 'vitest';
import {emptyDocument,saveDocument} from '../src/storage';
import {launchApp,settle} from './launch-app';
vi.mock('../src/storage',async importOriginal=>{const actual=await importOriginal();return {...actual,saveDocument:vi.fn(actual.saveDocument)}});
it('waits for an autosave promise after its debounce timer has fired',async()=>{
 await launchApp({...emptyDocument(),title:'준비',blocks:[{type:'paragraph',content:'본문'}]});
 let finish;
 saveDocument.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
 const view=document.querySelector('.ProseMirror').editor;
 act(()=>view.view.dispatch(view.state.tr.insertText('수정 ',1)));
 await vi.waitFor(()=>expect(saveDocument).toHaveBeenCalledOnce());
 expect(document.querySelector('.save-status').textContent).toContain('저장 중…');
 const timer=schedule(()=>finish(),100);
 try{await act(()=>settle());expect(document.querySelector('.save-status').textContent).toContain('저장됨')}
 finally{cancel(timer);await act(async()=>finish())}
});
