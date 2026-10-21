import {describe,it,expect,afterEach,vi} from 'vitest';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openDB} from 'idb';
import {IDBFactory} from 'fake-indexeddb';
import {saveDocument,loadDocument,emptyDocument,restoredFromPrevious} from '../src/storage';
const {bundlePath,validatePDF,serializeDraft,safeName,externalURL,atomicWrite,resolveImage}=createRequire(import.meta.url)('../electron/files.cjs');

afterEach(()=>{delete window.desktop;vi.unstubAllGlobals()});

describe('desktop file boundaries',()=>{
 it('serves only the bundled editor files',()=>{
  const root=path.resolve('bundle','dist');
  expect(bundlePath(root,'app://editor/assets/main.js')).toBe(path.join(root,'assets','main.js'));
  expect(bundlePath(root,'app://editor/')).toBe(path.join(root,'index.html'));
  for(const url of ['app://other/index.html','file:///etc/passwd','app://editor/%2e%2e%2fsecret','app://editor/%5c..%5csecret','app://user:pass@editor/','app://editor/%00'])expect(bundlePath(root,url)).toBeNull();
 });
 it('allows ordinary links but never local files or executable URL schemes',()=>{
  expect(externalURL('https://example.com/path')).toBe('https://example.com/path');
  expect(externalURL('mailto:hello@example.com')).toBe('mailto:hello@example.com');
  for(const url of ['javascript:alert(1)','file:///etc/passwd','app://editor/','https://user:pass@example.com','not a URL'])expect(externalURL(url)).toBeNull();
 });
 it('validates PDFs and document snapshots before writing',()=>{
  expect(validatePDF({paper:'A4',pageCount:2,html:'<html></html>'}).pageCount).toBe(2);
  for(const job of [{paper:'A5',pageCount:1,html:''},{paper:'A3',pageCount:301,html:''},{paper:'A4',pageCount:1.5,html:''},{paper:'A4',pageCount:1,html:123}])expect(()=>validatePDF(job)).toThrow('올바른 용지와 페이지 구성이 필요합니다.');
  expect(()=>validatePDF({paper:'A4',pageCount:1,html:'x'.repeat(100*1024*1024+1)})).toThrow('문서가 너무 커서 PDF로 저장할 수 없습니다');
  expect(JSON.parse(serializeDraft(emptyDocument())).version).toBe(2);
  expect(()=>serializeDraft({blocks:[]})).toThrow();
  expect(safeName('../../my:resume.pdf')).not.toMatch(/[/:]/);
 });
 it('atomically replaces a document without leaving temporary files',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'resume-desktop-test-'));
  try{const file=path.join(folder,'document.json');await atomicWrite(file,'first');await atomicWrite(file,'second');expect(await readFile(file,'utf8')).toBe('second');expect(await readdir(folder)).toEqual(['document.json'])}finally{await rm(folder,{recursive:true,force:true})}
 });
 it('rejects non-image responses and local file addresses',async()=>{
  await expect(resolveImage('file:///etc/passwd')).rejects.toThrow();
  const fetchMock=vi.fn().mockResolvedValue({ok:true,headers:new Map([['content-type','text/html']])});vi.stubGlobal('fetch',fetchMock);
  await expect(resolveImage('https://example.com/image')).rejects.toThrow();expect(fetchMock).toHaveBeenCalledOnce();
 });
});

describe('desktop autosave',()=>{
 it('avoids writing the same current document to both disk and IndexedDB',async()=>{
  const db=await openDB('local-notion-editor',1),old={...emptyDocument(),title:'이전 브라우저 저장'},doc={...emptyDocument(),title:'현재 앱 저장'};
  await db.put('documents',old,'current');window.desktop={saveDraft:vi.fn().mockResolvedValue()};
  await saveDocument(doc);expect(window.desktop.saveDraft).toHaveBeenCalledWith(doc);expect(await db.get('documents','current')).toEqual(old);
  delete window.desktop;await saveDocument(doc);expect(await db.get('documents','current')).toEqual(doc);db.close();
 });
 it('waits for the disk write before reporting completion',async()=>{
  const doc={...emptyDocument(),title:'앱 자동 저장 확인'};let complete;
  window.desktop={saveDraft:vi.fn(()=>new Promise(resolve=>{complete=resolve}))};
  let finished=false;const saving=saveDocument(doc).then(()=>{finished=true});
  await vi.waitFor(()=>expect(window.desktop.saveDraft).toHaveBeenCalledWith(doc));
  expect(finished).toBe(false);complete();await saving;expect(finished).toBe(true);
 });
 it('loads the disk draft and preserves images, columns and page settings',async()=>{
  const doc={...emptyDocument(),title:'다시 연 문서',paper:'A4',marginLeft:18,blocks:[{id:'image',type:'image',props:{url:'data:image/png;base64,AAAA'}}]};
  window.desktop={loadDraft:vi.fn().mockResolvedValue(doc)};
  expect(await loadDocument()).toMatchObject(doc);
 });
 it('reports a draft restored from the previous copy without keeping the mark in the document',async()=>{
  const doc={...emptyDocument(),title:'이전 저장본'};window.desktop={loadDraft:vi.fn().mockResolvedValue({...doc,restoredFromPrevious:true})};
  const loaded=await loadDocument();expect(restoredFromPrevious).toBe(true);expect(loaded.title).toBe('이전 저장본');expect(loaded).not.toHaveProperty('restoredFromPrevious');
  const db=await openDB('local-notion-editor',1);expect(await db.get('documents','current')).not.toHaveProperty('restoredFromPrevious');db.close();
  window.desktop={loadDraft:vi.fn().mockResolvedValue(doc)};await loadDocument();expect(restoredFromPrevious).toBe(false);
 });
 it('opens the disk draft and only turns off revision history when IndexedDB cannot be opened',async()=>{
  vi.stubGlobal('indexedDB',new IDBFactory());(await openDB('local-notion-editor',2)).close();
  vi.resetModules();const storage=await import('../src/storage'),draft={...emptyDocument(),title:'디스크 초안'};
  window.desktop={loadDraft:vi.fn().mockResolvedValue(draft)};expect(await storage.loadDocument()).toMatchObject(draft);
  await expect(storage.revision(draft)).resolves.toBeUndefined();const history=await storage.listRevisions();expect(history).toHaveLength(0);expect(history.unavailable).toBe(true);
  window.desktop={loadDraft:vi.fn().mockResolvedValue(null)};await expect(storage.loadDocument()).rejects.toThrow();
 });
 it('propagates disk errors so closing can be canceled',async()=>{
  window.desktop={saveDraft:vi.fn().mockRejectedValue(Error('disk full'))};
  await expect(saveDocument(emptyDocument())).rejects.toThrow('disk full');
 });
});
