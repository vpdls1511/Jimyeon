import {beforeAll,expect,it,vi} from 'vitest';
import {Blob as NodeBlob} from 'node:buffer';
import {emptyDocument} from '../src/document';
import {launchApp} from './launch-app';
const notice='저장 공간을 확인하고 문서 파일로 저장해 주세요.';
let closing;
const title=()=>document.querySelector('#document-title'),status=()=>document.querySelector('.save-status').textContent.trim(),toast=()=>document.querySelector('.toast')?.textContent;
function rename(value){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(title(),value);title().dispatchEvent(new Event('input',{bubbles:true}))}
function hide(){Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden}
beforeAll(async()=>{
 // jsdom's Blob has no arrayBuffer(), which the desktop file save uses.
 vi.stubGlobal('Blob',NodeBlob);
 window.desktop={loadDraft:vi.fn().mockResolvedValue({...emptyDocument(),title:'보고서'}),saveDraft:vi.fn().mockResolvedValue(),saveFile:vi.fn().mockResolvedValue(true),onCommand:()=>()=>{},onBeforeClose:callback=>{closing=callback;return()=>{}}};
 await launchApp();await vi.waitFor(()=>expect(title()?.value).toBe('보고서'));
},30000);

// Wait for '저장 중…' first: React commits the new state after the input event, so the old state is still on screen right after it.
async function edit(value){rename(value);await vi.waitFor(()=>expect(status()).toBe('저장 중…'))}
// Hide while the debounced save is still pending, so only the hide save can settle the state.
async function editThenHide(value){await edit(value);const before=window.desktop.saveDraft.mock.calls.length;hide();return before}
it('shows the saved state when a pending edit is saved because the window was hidden',async()=>{
 const before=await editThenHide('보고서 1');
 await vi.waitFor(()=>expect(status()).toBe('저장됨'));expect(window.desktop.saveDraft).toHaveBeenCalledTimes(before+1);expect(window.desktop.saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({title:'보고서 1'}));
});
it('reports a failed save that ran because the window was hidden',async()=>{
 window.desktop.saveDraft.mockRejectedValueOnce(Error('EPERM: operation not permitted'));const before=await editThenHide('보고서 2');
 await vi.waitFor(()=>expect(status()).toBe('저장 실패'));expect(toast()).toBe(notice);expect(window.desktop.saveDraft).toHaveBeenCalledTimes(before+1);
});
it('still saves a document file when autosave keeps failing, without writing the autosave again',async()=>{
 window.desktop.saveDraft.mockRejectedValue(Error('ENOSPC: no space left on device'));
 try{
  await edit('보고서 3');await vi.waitFor(()=>expect(status()).toBe('저장 실패'));const autosaves=window.desktop.saveDraft.mock.calls.length;
  document.querySelector('#save-json').click();const form=await vi.waitFor(()=>document.querySelector('form[aria-labelledby="save-document-title"]')||Promise.reject(Error('저장 대화상자가 열리지 않았습니다.')));
  form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(window.desktop.saveFile).toHaveBeenCalledWith(expect.objectContaining({name:'보고서 3.jimyeon',type:'application/json'})));
  await vi.waitFor(()=>expect(toast()).toBe('내용과 배치를 문서 파일로 저장했습니다.'));
  expect(window.desktop.saveDraft).toHaveBeenCalledTimes(autosaves);expect(status()).toBe('저장 실패');
 }finally{window.desktop.saveDraft.mockResolvedValue()}
});
it('explains a failed save while closing with the same notice',async()=>{
 await edit('보고서 4');await vi.waitFor(()=>expect(status()).toBe('저장됨'));
 window.desktop.saveDraft.mockRejectedValueOnce(Error("Error invoking remote method 'editor:save-draft': Error: EPERM"));
 await expect(closing()).rejects.toThrow(notice);await vi.waitFor(()=>expect(status()).toBe('저장 실패'));
});
it('refuses an attachment that would push the desktop document past 100MB and says why',async()=>{
 // BlockNote keeps the editor on the ProseMirror schema; this calls the same upload hook the file panel and drops use.
 const editor=document.querySelector('.ProseMirror').editor.schema.cached.blockNoteEditor;
 await expect(editor.uploadFile({name:'영상.mp4',type:'video/mp4',size:80*1024*1024})).rejects.toThrow('100MB');
 await vi.waitFor(()=>expect(toast()).toContain('100MB'));
});
it('shows a failed save when the snapshot itself throws, and saves again later',async()=>{
  await edit('보고서 5');await vi.waitFor(()=>expect(status()).toBe('저장됨'));
 const spy=vi.spyOn(globalThis,'structuredClone').mockImplementationOnce(()=>{throw Error('clone failed')});
 try{await edit('보고서 6');await vi.waitFor(()=>expect(status()).toBe('저장 실패'));expect(toast()).toBe(notice)}finally{spy.mockRestore()}
 const calls=window.desktop.saveDraft.mock.calls.length;hide();
 await vi.waitFor(()=>expect(status()).toBe('저장됨'));expect(window.desktop.saveDraft.mock.calls.length).toBe(calls+1);
});
