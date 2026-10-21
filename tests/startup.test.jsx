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
it('still downloads a document file after autosave fails because IndexedDB cannot be opened',async()=>{
 const title=document.querySelector('#document-title');URL.createObjectURL=vi.fn(()=>'blob:document');URL.revokeObjectURL=()=>{};
 Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(title,'백업할 문서');title.dispatchEvent(new Event('input',{bubbles:true}));
 await vi.waitFor(()=>expect(document.querySelector('.save-status').textContent).toContain('저장 실패'));expect(document.querySelector('.toast')?.textContent).toBe('저장 공간을 확인하고 문서 파일로 저장해 주세요.');
 document.querySelector('#save-json').click();const form=await vi.waitFor(()=>document.querySelector('form[aria-labelledby="save-document-title"]')||Promise.reject(Error('저장 대화상자가 열리지 않았습니다.')));
 form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await vi.waitFor(()=>expect(URL.createObjectURL).toHaveBeenCalledOnce());await vi.waitFor(()=>expect(document.querySelector('.toast')?.textContent).toBe('내용과 배치를 문서 파일로 저장했습니다.'));
},30000);
