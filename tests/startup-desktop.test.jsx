import {expect,it,vi} from 'vitest';
import {emptyDocument} from '../src/document';
import {launchApp,importDocument} from './launch-app';

it('renders a recovery notice when the desktop drafts cannot be read and autosaves the imported document',async()=>{
 const notice='자동 저장 문서를 읽지 못했습니다. 저장된 문서 파일을 가져와 주세요.';
 window.desktop={loadDraft:vi.fn().mockRejectedValue(Error(`Error invoking remote method 'editor:load-draft': Error: ${notice}`)),saveDraft:vi.fn().mockResolvedValue(),onCommand:()=>()=>{},onBeforeClose:()=>()=>{}};
 await launchApp();
 const title=()=>document.querySelector('#document-title'),alert=()=>document.querySelector('[role="alert"]');
 await vi.waitFor(()=>expect(alert()?.textContent).toContain(notice));expect(title().value).toBe('');
 importDocument({...emptyDocument(),title:'가져온 문서'});await vi.waitFor(()=>expect(title().value).toBe('가져온 문서'));
 await vi.waitFor(()=>expect(window.desktop.saveDraft).toHaveBeenCalledWith(expect.objectContaining({title:'가져온 문서'})));
},30000);
