import {it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
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
it('retries a failed save without treating it as successfully cached',()=>fixture(async folder=>{
 const write=vi.fn().mockRejectedValueOnce(Error('disk full')).mockImplementation(atomicWrite),store=createDraftStore(folder,write),doc=emptyDocument();
 await expect(store.save(doc)).rejects.toThrow('disk full');await store.save(doc);expect(write).toHaveBeenCalledTimes(2);
 expect(await store.load()).toEqual(doc);
}));
