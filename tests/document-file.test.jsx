import {expect,it} from 'vitest';
import {DOCUMENT_EXTENSION,LEGACY_ID,isDocumentFile,parseDocumentFile,emptyDocument} from '../src/document';

it('opens Jimyeon and legacy document backups without treating them as Markdown',()=>{
 expect(DOCUMENT_EXTENSION).toBe('.jimyeon');
 for(const name of ['문서.jimyeon','문서.JIMYEON','기존.backup.json','기존.json'])expect(isDocumentFile(name)).toBe(true);
 for(const name of ['문서.md','문서.jimyeon.md','문서.html'])expect(isDocumentFile(name)).toBe(false);
});

it('round-trips document layout and images and rejects unrelated JSON documents',()=>{
 const doc={...emptyDocument(),title:'지면 문서',paper:'A4',marginLeft:22,blocks:[{id:'columns',type:'columnList',children:[{id:'left',type:'column',props:{width:.4},children:[{id:'image',type:'image',props:{url:'data:image/png;base64,AAAA',textAlignment:'center',spaceBefore:8}}]},{id:'right',type:'column',props:{width:.6},children:[{id:'text',type:'paragraph',content:'보존할 내용'}]}]}]};
 expect(parseDocumentFile(JSON.stringify(doc))).toEqual(doc);
 for(const text of ['null','{}','{"blocks":[]}','invalid'])expect(()=>parseDocumentFile(text)).toThrow();
});

it('saves the Jimyeon format identifier and still opens files saved with the previous one',()=>{
 const current={...emptyDocument(),title:'새 형식 문서'},legacy={...emptyDocument(),format:LEGACY_ID,title:'이전 형식 문서'};
 expect(current.format).toBe('jimyeon');
 for(const doc of [current,legacy])expect(parseDocumentFile(JSON.stringify(doc))).toEqual({...current,title:doc.title});
 expect(()=>parseDocumentFile(JSON.stringify({...current,format:'other-editor'}))).toThrow('이 에디터에서 저장한 문서를 선택하세요.');
});

it('explains a truncated or corrupted document file in Korean',()=>{
 const text=JSON.stringify({...emptyDocument(),title:'이력서'});
 for(const broken of [text.slice(0,67),'invalid'])expect(()=>parseDocumentFile(broken)).toThrow('문서 파일이 손상되었거나 형식이 올바르지 않습니다.');
});

it('replaces document properties of the wrong type with their defaults',()=>{
 const doc=parseDocumentFile(JSON.stringify({...emptyDocument(),title:{ko:'이력서'},icon:{emoji:'📄'},cover:42,coverPosition:'30',locked:'yes',font:3,paper:'A3',blocks:[{type:'paragraph',content:'본문'}]}));
 expect(doc).toMatchObject({title:'',icon:'',cover:'',coverPosition:50,locked:false,font:'default',paper:'A3'});
 expect(doc.blocks[0].content).toBe('본문');
});
