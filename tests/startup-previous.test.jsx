import {expect,it,vi} from 'vitest';
import {emptyDocument} from '../src/document';
import {launchApp} from './launch-app';

it('tells the user when the desktop opened the previous draft because the latest one could not be read',async()=>{
 window.desktop={loadDraft:vi.fn().mockResolvedValue({...emptyDocument(),title:'이전 저장본',restoredFromPrevious:true}),saveDraft:vi.fn().mockResolvedValue(),onCommand:()=>()=>{},onBeforeClose:()=>()=>{}};
 await launchApp();
 const title=()=>document.querySelector('#document-title'),alert=()=>document.querySelector('[role="alert"]');
 await vi.waitFor(()=>expect(alert()?.textContent).toContain('최근 저장본을 읽지 못해 이전 저장본을 열었습니다. 읽지 못한 파일은 같은 폴더에 옮겨 두었습니다.'));
 expect(title().value).toBe('이전 저장본');
 // The mark only drives the notice and is never written back with the document.
 Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(title(),'이전 저장본 수정');title().dispatchEvent(new Event('input',{bubbles:true}));
 await vi.waitFor(()=>expect(window.desktop.saveDraft).toHaveBeenCalledWith(expect.objectContaining({title:'이전 저장본 수정'})));
 for(const [doc] of window.desktop.saveDraft.mock.calls)expect(doc).not.toHaveProperty('restoredFromPrevious');
},30000);
