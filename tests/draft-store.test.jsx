import {it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,writeFile,rm,readdir,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {emptyDocument,LEGACY_ID} from '../src/document';
const require=createRequire(import.meta.url);
const {createDraftStore}=require('../electron/draft-store.cjs');
const {atomicWrite}=require('../electron/files.cjs');
const fsPromises=require('node:fs/promises');
async function fixture(run){const folder=await mkdtemp(path.join(tmpdir(),'resume-draft-'));try{await run(folder)}finally{await rm(folder,{recursive:true,force:true})}}

it('writes consecutive identical snapshots once, including concurrent requests',()=>fixture(async folder=>{
 const write=vi.fn(atomicWrite),store=createDraftStore(folder,write),doc=emptyDocument();
 await Promise.all([store.save(doc),store.save(doc),store.save(structuredClone(doc))]);
 expect(write).toHaveBeenCalledTimes(1);expect(JSON.parse(await readFile(path.join(folder,'document.json'),'utf8'))).toEqual(doc);
}));
it('does not rewrite an unchanged document on launch or close',()=>fixture(async folder=>{
 const doc={...emptyDocument(),title:'기존 이력서'};await atomicWrite(path.join(folder,'document.json'),JSON.stringify(doc));
 const write=vi.fn(atomicWrite),store=createDraftStore(folder,write);expect(await store.load()).toEqual(doc);await store.save(doc);expect(write).not.toHaveBeenCalled();
}));
it('keeps save order and the last valid backup when repairing a corrupt primary',()=>fixture(async folder=>{
 const a={...emptyDocument(),title:'first'},b={...emptyDocument(),title:'second'},store=createDraftStore(folder);
 await Promise.all([store.save(a),store.save(b)]);
 expect(JSON.parse(await readFile(path.join(folder,'document.json'),'utf8'))).toEqual(b);
 await writeFile(path.join(folder,'document.json'),'broken');
 const recovered=createDraftStore(folder);expect(await recovered.load()).toEqual({...a,restoredFromPrevious:true});await recovered.save(a);
 expect(JSON.parse(await readFile(path.join(folder,'document.json'),'utf8'))).toEqual(a);
 expect(JSON.parse(await readFile(path.join(folder,'document.previous.json'),'utf8'))).toEqual(a);
}));
it('opens drafts saved with the previous format identifier and saves new drafts with the Jimyeon one',()=>fixture(async folder=>{
 const legacy={...emptyDocument(),format:LEGACY_ID,title:'이전 형식 초안'},doc={...emptyDocument(),title:'새 형식 초안'};
 await atomicWrite(path.join(folder,'document.json'),'broken');await atomicWrite(path.join(folder,'document.previous.json'),JSON.stringify(legacy));
 expect(await createDraftStore(folder).load()).toEqual({...legacy,restoredFromPrevious:true});
 await atomicWrite(path.join(folder,'document.json'),JSON.stringify(legacy));const store=createDraftStore(folder);expect(await store.load()).toEqual(legacy);
 expect(doc.format).toBe('jimyeon');await store.save(doc);
 expect(JSON.parse(await readFile(path.join(folder,'document.json'),'utf8'))).toEqual(doc);expect(JSON.parse(await readFile(path.join(folder,'document.previous.json'),'utf8'))).toEqual(legacy);
}));
it('keeps unreadable drafts for manual recovery before autosave replaces them',()=>fixture(async folder=>{
 await writeFile(path.join(folder,'document.json'),'{"title":"잘린 문서');await writeFile(path.join(folder,'document.previous.json'),'{"title":"잘린 이전 문서');
 const store=createDraftStore(folder);await expect(store.load()).rejects.toThrow('자동 저장 문서를 읽지 못했습니다');
 await store.save({...emptyDocument(),title:'first'});await store.save({...emptyDocument(),title:'second'});
 const files=await readdir(folder),kept=name=>readFile(path.join(folder,files.find(file=>file.startsWith(name+'.corrupt-'))),'utf8');
 expect(files.filter(file=>file.includes('.corrupt-'))).toHaveLength(2);expect(await kept('document')).toBe('{"title":"잘린 문서');expect(await kept('document.previous')).toBe('{"title":"잘린 이전 문서');
 expect(JSON.parse(await readFile(path.join(folder,'document.json'),'utf8')).title).toBe('second');
}));
// File modes cannot block reads on Windows or for root.
const posixUser=process.platform!=='win32'&&process.getuid?.()!==0;
it.runIf(posixUser)('moves drafts aside even when they cannot be read or copied',()=>fixture(async folder=>{
 await writeFile(path.join(folder,'document.json'),'{"title":"권한 없는 문서"}');await writeFile(path.join(folder,'document.previous.json'),'{"title":"권한 없는 이전 문서"}');
 for(const file of ['document.json','document.previous.json'])await chmod(path.join(folder,file),0);
 const store=createDraftStore(folder);await expect(store.load()).rejects.toThrow('자동 저장 문서를 읽지 못했습니다');
 await store.save({...emptyDocument(),title:'first'});await store.save({...emptyDocument(),title:'second'});
 const kept=(await readdir(folder)).filter(file=>file.includes('.corrupt-')).sort();expect(kept).toHaveLength(2);
 for(const file of kept)await chmod(path.join(folder,file),0o600);
 expect(await readFile(path.join(folder,kept[0]),'utf8')).toBe('{"title":"권한 없는 문서"}');expect(await readFile(path.join(folder,kept[1]),'utf8')).toBe('{"title":"권한 없는 이전 문서"}');
}));
it.runIf(posixUser)('keeps unreadable drafts in place and fails saving while the folder does not allow moving them',()=>fixture(async folder=>{
 await writeFile(path.join(folder,'document.json'),'broken');await writeFile(path.join(folder,'document.previous.json'),'broken previous');await chmod(folder,0o500);
 try{
  const store=createDraftStore(folder);await expect(store.load()).rejects.toThrow('자동 저장 문서를 읽지 못했습니다');await expect(store.save(emptyDocument())).rejects.toThrow();
  expect(await readFile(path.join(folder,'document.json'),'utf8')).toBe('broken');expect(await readFile(path.join(folder,'document.previous.json'),'utf8')).toBe('broken previous');
 }finally{await chmod(folder,0o700)}
}));
it('retries moving unreadable drafts aside before each save and fails the save until they move',()=>fixture(async folder=>{
 await writeFile(path.join(folder,'document.json'),'{"title":"잠긴 문서');await writeFile(path.join(folder,'document.previous.json'),'{"title":"잠긴 이전 문서');
 // Like a Windows file lock held by another program: the first two moves fail, then the lock is gone.
 const locked=Object.assign(Error('EBUSY: resource busy or locked'),{code:'EBUSY'}),rename=vi.spyOn(fsPromises,'rename').mockRejectedValueOnce(locked).mockRejectedValueOnce(locked);
 try{
  const store=createDraftStore(folder);await expect(store.load()).rejects.toThrow('자동 저장 문서를 읽지 못했습니다');
  await expect(store.save({...emptyDocument(),title:'first'})).rejects.toThrow('EBUSY');expect(await readFile(path.join(folder,'document.json'),'utf8')).toBe('{"title":"잠긴 문서');
  await store.save({...emptyDocument(),title:'second'});await store.save({...emptyDocument(),title:'third'});
 }finally{rename.mockRestore()}
 const files=await readdir(folder),kept=name=>readFile(path.join(folder,files.find(file=>file.startsWith(name+'.corrupt-'))),'utf8');
 expect(files.filter(file=>file.includes('.corrupt-'))).toHaveLength(2);expect(await kept('document')).toBe('{"title":"잠긴 문서');expect(await kept('document.previous')).toBe('{"title":"잠긴 이전 문서');
 expect(JSON.parse(await readFile(path.join(folder,'document.json'),'utf8')).title).toBe('third');
}));
it('moves an unreadable primary aside before saving when the previous draft opens instead',()=>fixture(async folder=>{
 const backup={...emptyDocument(),title:'이전 저장본'};
 await writeFile(path.join(folder,'document.json'),'{"title":"더 최근에 잘린 문서');await writeFile(path.join(folder,'document.previous.json'),JSON.stringify(backup));
 const store=createDraftStore(folder);expect(await store.load()).toEqual({...backup,restoredFromPrevious:true});await store.save({...emptyDocument(),title:'next'});
 const kept=(await readdir(folder)).find(file=>file.startsWith('document.corrupt-'));expect(kept).toBeDefined();
 expect(await readFile(path.join(folder,kept),'utf8')).toBe('{"title":"더 최근에 잘린 문서');
 expect(JSON.parse(await readFile(path.join(folder,'document.json'),'utf8')).title).toBe('next');expect(JSON.parse(await readFile(path.join(folder,'document.previous.json'),'utf8'))).toEqual(backup);
}));
it('forgets drafts left unmoved by an earlier load once they open normally',()=>fixture(async folder=>{
 const doc={...emptyDocument(),title:'다시 열린 문서'},store=createDraftStore(folder);await writeFile(path.join(folder,'document.json'),'{"title":"잠긴 문서');
 const rename=vi.spyOn(fsPromises,'rename').mockRejectedValueOnce(Object.assign(Error('EBUSY: resource busy or locked'),{code:'EBUSY'}));
 try{await expect(store.load()).rejects.toThrow('자동 저장 문서를 읽지 못했습니다')}finally{rename.mockRestore()}
 // A reopened window loads again in the same process after the file became readable.
 await atomicWrite(path.join(folder,'document.json'),JSON.stringify(doc));expect(await store.load()).toEqual(doc);
 await store.save({...doc,title:'이어서 쓴 문서'});
 expect((await readdir(folder)).filter(file=>file.includes('.corrupt-'))).toEqual([]);expect(JSON.parse(await readFile(path.join(folder,'document.json'),'utf8')).title).toBe('이어서 쓴 문서');
}));
it('retries a failed save without treating it as successfully cached',()=>fixture(async folder=>{
 const write=vi.fn().mockRejectedValueOnce(Error('disk full')).mockImplementation(atomicWrite),store=createDraftStore(folder,write),doc=emptyDocument();
 await expect(store.save(doc)).rejects.toThrow('disk full');await store.save(doc);expect(write).toHaveBeenCalledTimes(2);
 expect(await store.load()).toEqual(doc);
}));
