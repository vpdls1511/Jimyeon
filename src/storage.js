import {openDB} from 'idb';
import {emptyDocument,migrateDocument,LEGACY_ID} from './document';
export {emptyDocument,migrateDocument} from './document';
// Earlier versions kept the same stores in a database named LEGACY_ID. Its data is copied into the new database once, and a marker in the
// new database records that the copy was handled. The old database is never deleted: an old tab still open could block the deletion, and
// a deletion lost half-way would otherwise leave the old data to be read at every start. The marker is checked and written in the same
// transaction as the copy, so two tabs starting together cannot overwrite a document the other one already saved.
const MOVED_KEY='legacyMoved';
async function moveLegacyData(db){
 if(await db.get('documents',MOVED_KEY))return;
 // Opening a missing database creates it, so skip that when the browser can list databases.
 const known=await indexedDB.databases?.().catch(()=>null);if(known&&!known.some(({name})=>name===LEGACY_ID))return;
 const legacy=await openDB(LEGACY_ID),names=['documents','revisions'].filter(name=>legacy.objectStoreNames.contains(name));let data=[];
 try{if(names.length){const tx=legacy.transaction(names);data=await Promise.all(names.map(async name=>{const store=tx.objectStore(name);return [name,await store.getAllKeys(),await store.getAll()]}))}}finally{legacy.close()}
 const tx=db.transaction(['documents','revisions'],'readwrite');tx.done.catch(()=>{});
 try{
  // A new database that already holds data (the marker counts too) is kept as is; only the marker is written.
  if(!await tx.objectStore('documents').count()&&!await tx.objectStore('revisions').count()){
   for(const [name,keys,values] of data){const store=tx.objectStore(name);for(const [i,key] of keys.entries())await (store.keyPath?store.put(values[i]):store.put(values[i],key))}
  }
  await tx.objectStore('documents').put(true,MOVED_KEY);await tx.done;
 }catch(error){try{tx.abort()}catch{}throw error}
}
const dbPromise=openDB('jimyeon',1,{upgrade(db){db.createObjectStore('documents');db.createObjectStore('revisions',{keyPath:'time'});}}).then(async db=>{try{await moveLegacyData(db)}catch(error){db.close();throw error}return db});
// Without IndexedDB the editor still opens; only revision history is unavailable, and listRevisions marks its empty list so.
const historyDB=dbPromise.catch(()=>null);
// True when the desktop opened the previous draft because the latest could not be read. migrateDocument drops the mark from the document itself.
export let restoredFromPrevious=false;
export async function loadDocument(){const draft=await window.desktop?.loadDraft();restoredFromPrevious=draft?.restoredFromPrevious===true;try{const db=await dbPromise;const tx=db.transaction(['documents','revisions'],'readwrite');const current=draft||await tx.objectStore('documents').get('current');const doc=migrateDocument(current);if(draft||current?.version!==2||current.threads||current.proseMirrorJSON)await tx.objectStore('documents').put(doc,'current');let cursor=await tx.objectStore('revisions').openCursor();while(cursor){const entry=cursor.value;if(entry.doc.version!==2||entry.doc.threads||entry.doc.proseMirrorJSON)await cursor.update({...entry,doc:migrateDocument(entry.doc)});cursor=await cursor.continue()}await tx.done;return doc}catch(error){if(!draft)throw error;console.error('저장 기록을 열지 못했습니다:',error);return migrateDocument(draft)}}
export async function saveDocument(doc){if(window.desktop)return window.desktop.saveDraft(doc);await (await dbPromise).put('documents',doc,'current')}
export async function revision(doc){const db=await historyDB;if(!db)return;await db.put('revisions',{time:Date.now(),doc:structuredClone(doc)});const keys=await db.getAllKeys('revisions');for(const key of keys.slice(0,-20))await db.delete('revisions',key)}
export async function listRevisions(){const db=await historyDB;return db?(await db.getAll('revisions')).reverse():Object.assign([],{unavailable:true})}
export function readFileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})}
// BlockNote expects a partial block, with file data inside props.
export async function uploadLocalFile(file){return {props:{url:await readFileData(file),name:file.name}}}
export async function download(name,text,type){const blob=new Blob([text],{type});if(window.desktop)return window.desktop.saveFile({name,type,bytes:new Uint8Array(await blob.arrayBuffer())});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}
