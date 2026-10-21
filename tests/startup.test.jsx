import {expect,it,vi} from 'vitest';
import {openDB} from 'idb';
import {emptyDocument} from '../src/document';
import {launchApp,importDocument} from './launch-app';

it('renders a recovery notice with working import and new document when IndexedDB cannot be opened',async()=>{
 // A database left at a newer version makes the editor's openDB fail with VersionError.
 (await openDB('local-notion-editor',2)).close();await launchApp();
 const title=()=>document.querySelector('#document-title'),alert=()=>document.querySelector('[role="alert"]'),body=()=>document.querySelector('.bn-editor').textContent;
 const menuItem=async label=>{document.querySelector('button[aria-label="문서 메뉴"]').click();return vi.waitFor(()=>[...document.querySelectorAll('.document-menu button')].find(button=>button.textContent.includes(label))||Promise.reject(Error('문서 메뉴가 열리지 않았습니다.')))};
 await vi.waitFor(()=>expect(alert()?.textContent).toContain('자동 저장 문서를 읽지 못했습니다. 저장된 문서 파일을 가져와 주세요.'));expect(title().value).toBe('');
 (await menuItem('저장 기록')).click();await vi.waitFor(()=>expect(document.querySelector('.modal p')?.textContent).toBe('이 환경에서는 저장 기록을 사용할 수 없습니다.'));
 [...document.querySelectorAll('.modal button')].find(button=>button.textContent==='닫기').click();await vi.waitFor(()=>expect(document.querySelector('.modal')).toBeNull());
 const choose=vi.spyOn(document.querySelector('input[type="file"][accept*=".jimyeon"]'),'click');
 [...alert().querySelectorAll('button')].find(button=>button.textContent==='가져오기').click();expect(choose).toHaveBeenCalledOnce();
 importDocument({...emptyDocument(),title:'가져온 문서',blocks:[{type:'paragraph',content:'복구한 본문'}]});
 await vi.waitFor(()=>expect(title().value).toBe('가져온 문서'));expect(body()).toContain('복구한 본문');
 (await menuItem('새 문서')).click();await vi.waitFor(()=>expect(title().value).toBe(''));expect(body()).not.toContain('복구한 본문');
 alert().querySelector('button[aria-label="닫기"]').click();await vi.waitFor(()=>expect(alert()).toBeNull());
},30000);
