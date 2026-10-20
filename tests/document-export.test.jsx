import {afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {Blob as NodeBlob} from 'node:buffer';
import {createDocumentExport} from '../src/document-export';
import {emptyDocument,parseDocumentFile} from '../src/document';
import {download} from '../src/storage';
const {saveFileOptions}=createRequire(import.meta.url)('../electron/files.cjs');
afterEach(()=>{delete window.desktop;vi.restoreAllMocks();vi.unstubAllGlobals()});

it('saves Jimyeon and JSON without losing layout or invoking lossy Markdown conversion',async()=>{
 const doc={...emptyDocument(),title:'문서',marginTop:24,blocks:[{type:'image',props:{url:'data:image/png;base64,AAAA',textAlignment:'center'}}]},markdown=vi.fn();
 for(const format of ['jimyeon','json']){
  const file=await createDocumentExport(doc,format,markdown);
  expect(file).toMatchObject({name:'문서.'+format,type:'application/json'});
  expect(parseDocumentFile(file.text)).toEqual(doc);
 }
 expect(markdown).not.toHaveBeenCalled();
 await expect(createDocumentExport(doc,'pdf',markdown)).rejects.toThrow('저장 형식');
});

it('exports actual Markdown instead of JSON under an md filename',async()=>{
 const doc={...emptyDocument(),title:'제목'},markdown=vi.fn().mockResolvedValue('# 본문\n');
 expect(await createDocumentExport(doc,'md',markdown)).toEqual({name:'제목.md',type:'text/markdown',text:'# 본문\n'});
 expect(markdown).toHaveBeenCalledWith(doc.blocks);
});

it('sets matching desktop file filters for all three formats and rejects invalid payloads',()=>{
 for(const [extension,type] of [['jimyeon','application/json'],['json','application/json'],['md','text/markdown']]){
  const options=saveFileOptions({name:'문서.'+extension,type,bytes:new Uint8Array([1])});
  expect(options.defaultPath).toBe('문서.'+extension);expect(options.filters[0].extensions).toEqual([extension]);
 }
 expect(saveFileOptions({type:'application/json',name:'문서',bytes:new Uint8Array()}).defaultPath).toBe('문서.jimyeon');
 expect(()=>saveFileOptions({type:'text/html',bytes:new Uint8Array()})).toThrow();
 expect(()=>saveFileOptions({type:'application/json',bytes:'not bytes'})).toThrow();
});

it('forwards the selected export filename and MIME type to the desktop bridge',async()=>{
 vi.stubGlobal('Blob',NodeBlob);
 const saveFile=vi.fn().mockResolvedValue(true);window.desktop={saveFile};
 await download('문서.json','{"blocks":[]}','application/json');
 expect(saveFile).toHaveBeenCalledWith({name:'문서.json',type:'application/json',bytes:expect.any(Uint8Array)});
});

it('downloads the selected format in a browser and releases its object URL',async()=>{
 vi.useFakeTimers();const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(){expect(this.download).toBe('문서.md');expect(this.href).toContain('blob:export')});
 const createObjectURL=vi.fn().mockReturnValue('blob:export'),revokeObjectURL=vi.fn();vi.stubGlobal('URL',class extends URL{static createObjectURL=createObjectURL;static revokeObjectURL=revokeObjectURL});
 try{expect(await download('문서.md','# 내용','text/markdown')).toBe(true);expect(click).toHaveBeenCalledOnce();expect(createObjectURL.mock.calls[0][0].type).toBe('text/markdown');vi.runAllTimers();expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')}finally{vi.useRealTimers()}
});
