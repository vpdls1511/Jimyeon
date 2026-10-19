import {expect,it} from 'vitest';
import {DOCUMENT_EXTENSION,isDocumentFile,parseDocumentFile,emptyDocument} from '../src/document';

it('opens Jimyeon and legacy document backups without treating them as Markdown',()=>{
 expect(DOCUMENT_EXTENSION).toBe('.jimyeon');
 for(const name of ['문서.jimyeon','문서.JIMYEON','기존.notion.json','기존.json'])expect(isDocumentFile(name)).toBe(true);
 for(const name of ['문서.md','문서.jimyeon.md','문서.html'])expect(isDocumentFile(name)).toBe(false);
});

it('round-trips document layout and images and rejects unrelated JSON documents',()=>{
 const doc={...emptyDocument(),title:'지면 문서',paper:'A4',marginLeft:22,blocks:[{id:'columns',type:'columnList',children:[{id:'left',type:'column',props:{width:.4},children:[{id:'image',type:'image',props:{url:'data:image/png;base64,AAAA',textAlignment:'center',spaceBefore:8}}]},{id:'right',type:'column',props:{width:.6},children:[{id:'text',type:'paragraph',content:'보존할 내용'}]}]}]};
 expect(parseDocumentFile(JSON.stringify(doc))).toEqual(doc);
 for(const text of ['null','{}','{"blocks":[]}','invalid'])expect(()=>parseDocumentFile(text)).toThrow();
});
