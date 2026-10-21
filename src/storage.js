import {openDB} from 'idb';
import {emptyDocument,migrateDocument} from './document';
export {emptyDocument,migrateDocument} from './document';
const dbPromise=openDB('local-notion-editor',1,{upgrade(db){db.createObjectStore('documents');db.createObjectStore('revisions',{keyPath:'time'});}});
// Without IndexedDB the editor still opens; only revision history is unavailable.
const historyDB=dbPromise.catch(()=>null);
export async function loadDocument(){const draft=await window.desktop?.loadDraft();try{const db=await dbPromise;const tx=db.transaction(['documents','revisions'],'readwrite');const current=draft||await tx.objectStore('documents').get('current');const doc=migrateDocument(current);if(draft||current?.version!==2||current.threads||current.proseMirrorJSON)await tx.objectStore('documents').put(doc,'current');let cursor=await tx.objectStore('revisions').openCursor();while(cursor){const entry=cursor.value;if(entry.doc.version!==2||entry.doc.threads||entry.doc.proseMirrorJSON)await cursor.update({...entry,doc:migrateDocument(entry.doc)});cursor=await cursor.continue()}await tx.done;return doc}catch(error){if(!draft)throw error;console.error('저장 기록을 열지 못했습니다:',error);return migrateDocument(draft)}}
export async function saveDocument(doc){if(window.desktop)return window.desktop.saveDraft(doc);await (await dbPromise).put('documents',doc,'current')}
export async function revision(doc){const db=await historyDB;if(!db)return;await db.put('revisions',{time:Date.now(),doc:structuredClone(doc)});const keys=await db.getAllKeys('revisions');for(const key of keys.slice(0,-20))await db.delete('revisions',key)}
export async function listRevisions(){const db=await historyDB;return db?(await db.getAll('revisions')).reverse():[]}
export function readFileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})}
// BlockNote expects a partial block, with file data inside props.
export async function uploadLocalFile(file){return {props:{url:await readFileData(file),name:file.name}}}
export async function download(name,text,type){const blob=new Blob([text],{type});if(window.desktop)return window.desktop.saveFile({name,type,bytes:new Uint8Array(await blob.arrayBuffer())});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}
