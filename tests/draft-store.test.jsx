import {it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,writeFile,rm,readdir,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {emptyDocument} from '../src/document';
const require=createRequire(import.meta.url);
const {createDraftStore}=require('../electron/draft-store.cjs');
const {atomicWrite}=require('../electron/files.cjs');
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
 const recovered=createDraftStore(folder);expect(await recovered.load()).toEqual(a);await recovered.save(a);
 expect(JSON.parse(await readFile(path.join(folder,'document.json'),'utf8'))).toEqual(a);
 expect(JSON.parse(await readFile(path.join(folder,'document.previous.json'),'utf8'))).toEqual(a);
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
it.runIf(posixUser)('leaves unreadable drafts in place when the folder cannot be written, because saving fails too',()=>fixture(async folder=>{
 await writeFile(path.join(folder,'document.json'),'broken');await writeFile(path.join(folder,'document.previous.json'),'broken previous');await chmod(folder,0o500);
 try{
  const store=createDraftStore(folder);await expect(store.load()).rejects.toThrow();await expect(store.save(emptyDocument())).rejects.toThrow();
  expect(await readFile(path.join(folder,'document.json'),'utf8')).toBe('broken');expect(await readFile(path.join(folder,'document.previous.json'),'utf8')).toBe('broken previous');
 }finally{await chmod(folder,0o700)}
}));
it('retries a failed save without treating it as successfully cached',()=>fixture(async folder=>{
 const write=vi.fn().mockRejectedValueOnce(Error('disk full')).mockImplementation(atomicWrite),store=createDraftStore(folder,write),doc=emptyDocument();
 await expect(store.save(doc)).rejects.toThrow('disk full');await store.save(doc);expect(write).toHaveBeenCalledTimes(2);
 expect(await store.load()).toEqual(doc);
}));
