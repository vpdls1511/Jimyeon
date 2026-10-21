import {openDB} from 'idb';
import {emptyDocument,migrateDocument} from './document';
export {emptyDocument,migrateDocument} from './document';
const dbPromise=openDB('local-notion-editor',1,{upgrade(db){db.createObjectStore('documents');db.createObjectStore('revisions',{keyPath:'time'});}});
// Without IndexedDB the editor still opens; only revision history is unavailable, and listRevisions marks its empty list so.
const historyDB=dbPromise.catch(()=>null);
// True when the desktop opened the previous draft because the latest could not be read. migrateDocument drops the mark from the document itself.
export let restoredFromPrevious=false;
export async function loadDocument(){const draft=await window.desktop?.loadDraft();restoredFromPrevious=draft?.restoredFromPrevious===true;try{const db=await dbPromise;const tx=db.transaction(['documents','revisions'],'readwrite');const current=draft||await tx.objectStore('documents').get('current');const doc=migrateDocument(current);if(draft||current?.version!==2||current.threads||current.proseMirrorJSON)await tx.objectStore('documents').put(doc,'current');let cursor=await tx.objectStore('revisions').openCursor();while(cursor){const entry=cursor.value;if(entry.doc.version!==2||entry.doc.threads||entry.doc.proseMirrorJSON)await cursor.update({...entry,doc:migrateDocument(entry.doc)});cursor=await cursor.continue()}await tx.done;return doc}catch(error){if(!draft)throw error;console.error('저장 기록을 열지 못했습니다:',error);return migrateDocument(draft)}}
export async function saveDocument(doc){if(window.desktop)return window.desktop.saveDraft(doc);await (await dbPromise).put('documents',doc,'current')}
export async function revision(doc){const db=await historyDB;if(!db)return;await db.put('revisions',{time:Date.now(),doc:structuredClone(doc)});const keys=await db.getAllKeys('revisions');for(const key of keys.slice(0,-20))await db.delete('revisions',key)}
export async function listRevisions(){const db=await historyDB;return db?(await db.getAll('revisions')).reverse():Object.assign([],{unavailable:true})}
// The desktop app refuses to autosave or save a document file above this size; keep it equal to MAX_DOCUMENT_BYTES in electron/files.cjs.
export const MAX_DESKTOP_DOCUMENT_BYTES=100*1024*1024;
const TOO_LARGE='문서가 100MB를 넘어 저장할 수 없습니다. 큰 첨부 파일을 지워 크기를 줄여 주세요.';
const documentBytes=doc=>new TextEncoder().encode(JSON.stringify(doc)).length;
// Measured only after a save fails, so ordinary autosaves do not pay for serializing the document twice.
export function saveFailureMessage(doc){return window.desktop&&documentBytes(doc)>MAX_DESKTOP_DOCUMENT_BYTES?TOO_LARGE:'저장 공간을 확인하고 문서 파일로 저장해 주세요.'}
export function readFileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})}
// BlockNote expects a partial block, with file data inside props. On the desktop, refuse a file before reading it
// when its data URL (4 bytes per 3, plus a short prefix) would push the document past the save limit.
export async function uploadLocalFile(file,doc){if(window.desktop&&doc&&documentBytes(doc)+Math.ceil(file.size/3)*4+100>MAX_DESKTOP_DOCUMENT_BYTES)throw Error('이 파일을 첨부하면 문서가 100MB를 넘어 저장할 수 없습니다. 더 작은 파일을 사용해 주세요.');return {props:{url:await readFileData(file),name:file.name}}}
export async function download(name,text,type){const blob=new Blob([text],{type});if(window.desktop){if(blob.size>MAX_DESKTOP_DOCUMENT_BYTES)throw Error(TOO_LARGE);return window.desktop.saveFile({name,type,bytes:new Uint8Array(await blob.arrayBuffer())})}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}
