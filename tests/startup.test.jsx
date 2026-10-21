import {expect,it,vi} from 'vitest';
import {openDB} from 'idb';
import {emptyDocument} from '../src/document';
import {launchApp,importDocument} from './launch-app';

it('renders a recovery notice with working import and new document when IndexedDB cannot be opened',async()=>{
 // A database left at a newer version makes the editor's openDB fail with VersionError.
 (await openDB('local-notion-editor',2)).close();await launchApp();
 const title=()=>document.querySelector('#document-title'),alert=()=>document.querySelector('[role="alert"]'),body=()=>document.querySelector('.bn-editor').textContent;
 await vi.waitFor(()=>expect(alert()?.textContent).toContain('자동 저장 문서를 읽지 못했습니다. 저장된 문서 파일을 가져와 주세요.'));expect(title().value).toBe('');
 const choose=vi.spyOn(document.querySelector('input[type="file"][accept*=".jimyeon"]'),'click');
 [...alert().querySelectorAll('button')].find(button=>button.textContent==='가져오기').click();expect(choose).toHaveBeenCalledOnce();
 importDocument({...emptyDocument(),title:'가져온 문서',blocks:[{type:'paragraph',content:'복구한 본문'}]});
 await vi.waitFor(()=>expect(title().value).toBe('가져온 문서'));expect(body()).toContain('복구한 본문');
 document.querySelector('button[aria-label="문서 메뉴"]').click();
 const newDoc=await vi.waitFor(()=>[...document.querySelectorAll('.document-menu button')].find(button=>button.textContent.includes('새 문서'))||Promise.reject(Error('문서 메뉴가 열리지 않았습니다.')));
 newDoc.click();await vi.waitFor(()=>expect(title().value).toBe(''));expect(body()).not.toContain('복구한 본문');
 alert().querySelector('button[aria-label="닫기"]').click();await vi.waitFor(()=>expect(alert()).toBeNull());
},30000);
