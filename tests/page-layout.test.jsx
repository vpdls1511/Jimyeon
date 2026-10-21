import {afterEach,describe,expect,it,vi} from 'vitest';
import {BlockNoteEditor} from '@blocknote/core';
import {schema} from '../src/blocks';
import {emptyDocument,migrateDocument} from '../src/document';
import {FOOTER_LINE_HEIGHT,footerStyle,gapBefore,pageMetrics,pageSettings,pageVariables,PAGE_GAP,PX_PER_MM} from '../src/page-settings';
import {livePagination,paginationKey,createLivePaginator} from '../src/live-pagination';
import {blockSelection,selectBlocks,selectedBlockIds} from '../src/block-selection';
import {freezeLiveSource,livePrintJob} from '../src/live-print';

afterEach(()=>document.body.replaceChildren());
it('suspends background pagination and resumes once the window is visible',async()=>{
 vi.useFakeTimers();let hidden=true;
 const visibility=vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
 const editor=BlockNoteEditor.create({schema,extensions:[livePagination],initialContent:[{type:'paragraph',content:'본문'}]}),source=document.createElement('div'),onLayout=vi.fn();
 document.body.append(source);editor.mount(source);
 const paginator=createLivePaginator({editor,source,getMeta:()=>({paper:'A4'}),onLayout,onState:()=>{}});
 try{await vi.advanceTimersByTimeAsync(200);expect(onLayout).not.toHaveBeenCalled();hidden=false;document.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(100);expect(onLayout).toHaveBeenCalledOnce();hidden=true;document.dispatchEvent(new Event('visibilitychange'));paginator.schedule();await vi.advanceTimersByTimeAsync(200);expect(onLayout).toHaveBeenCalledOnce()}
 finally{paginator.destroy();editor._tiptapEditor.destroy();visibility.mockRestore();vi.useRealTimers()}
});
describe('physical page settings',()=>{
 it('derives physical A4/A3 content dimensions from all four margins',()=>{
  const p=pageMetrics({paper:'A4',marginTop:22,marginBottom:20,marginLeft:24,marginRight:18});
  expect(p.width/PX_PER_MM).toBeCloseTo(210);expect(p.height/PX_PER_MM).toBeCloseTo(297);expect(p.bodyWidth/PX_PER_MM).toBeCloseTo(168);expect(p.bodyHeight/PX_PER_MM).toBeCloseTo(255);
  expect(pageMetrics({paper:'A3'}).height/PX_PER_MM).toBeCloseTo(420);
 });
 it('derives body and heading sizes from one base in points',()=>{
  const p=pageVariables({fontSize:14});expect(parseFloat(p['--body-size'])).toBeCloseTo(14*4/3);expect(parseFloat(p['--h1-size'])).toBeCloseTo(24*4/3);expect(parseFloat(p['--title-size'])).toBeCloseTo(32*4/3);
 });
 it('sizes the page title independently from body and content headings',()=>{
  const first=pageVariables({fontSize:12,titleFontSize:42}),changedBody=pageVariables({fontSize:16,titleFontSize:42}),changedTitle=pageVariables({fontSize:12,titleFontSize:24});
  expect(parseFloat(first['--title-size'])).toBe(56);expect(changedBody['--title-size']).toBe(first['--title-size']);
  expect(changedTitle['--body-size']).toBe(first['--body-size']);expect(changedTitle['--h1-size']).toBe(first['--h1-size']);expect(parseFloat(changedTitle['--title-size'])).toBe(32);
 });
 it('preserves old title appearance on migration and saves the independent size thereafter',()=>{
  const migrated=migrateDocument({fontSize:10});expect(migrated.titleFontSize).toBe(28);expect(migrateDocument({...migrated,fontSize:16}).titleFontSize).toBe(28);
  expect(migrateDocument({small:true}).titleFontSize).toBe(28.5);expect(migrateDocument({fontSize:12,titleFontSize:42}).titleFontSize).toBe(42);
  expect(pageSettings({titleFontSize:200}).titleFontSize).toBe(96);expect(pageSettings({titleFontSize:-1}).titleFontSize).toBe(8);
 });
 it('keeps the page number inside the bottom margin for every base font size',()=>{
  for(const fontSize of [8,12,15,18,24]){
   const p=pageMetrics({fontSize,marginBottom:0,pageNumber:'center'}),s=footerStyle({fontSize,marginBottom:0,pageNumber:'center'});
   expect(s.lineHeight).toBe(FOOTER_LINE_HEIGHT);
   expect(parseFloat(s.bottom)+parseFloat(s.fontSize)*FOOTER_LINE_HEIGHT).toBeLessThanOrEqual(p.bottom+.01);
  }
  expect(pageSettings({fontSize:14,pageNumber:'left',marginBottom:0}).marginBottom).toBe(8);
  expect(pageSettings({fontSize:24,pageNumber:'left',marginBottom:8}).marginBottom).toBe(14);
 });
 it('validates imported settings and reserves footer space only when numbering is enabled',()=>{
  expect(pageSettings({fontSize:100,marginLeft:-3,marginRight:100,pageNumber:'bad'})).toMatchObject({fontSize:24,marginLeft:0,marginRight:60,pageNumber:'none'});
  expect(pageSettings({marginBottom:0,pageNumber:'center'}).marginBottom).toBe(8);expect(pageSettings({marginBottom:0,pageNumber:'none'}).marginBottom).toBe(0);
 });
 it('round-trips document settings and upgrades the old small-text preference',()=>{
  const d={...emptyDocument(),fontSize:13.5,marginTop:10,marginBottom:20,marginLeft:25,marginRight:15,pageNumber:'right'};
  expect(migrateDocument(d)).toMatchObject(d);expect(migrateDocument({small:true}).fontSize).toBe(10.5);expect(migrateDocument({small:true}).small).toBe(false);
 });
 it('moves an overflowing line or row to the next body area and leaves fitting content alone',()=>{
  const p=pageMetrics({paper:'A4'}),end=p.height-p.bottom;
  expect(gapBefore(end-30,20,p)).toBe(0);expect(gapBefore(end-10,20,p)).toBeCloseTo(p.stride+p.top-(end-10));expect(gapBefore(p.stride+10,20,p)).toBeCloseTo(p.top-10);
 });
 it('places gray current/total numbering inside the configured bottom margin',()=>{
  const s=footerStyle({fontSize:12,marginBottom:20,pageNumber:'right'});expect(s.textAlign).toBe('right');expect(s.color).toBe('#929292');expect(parseFloat(s.bottom)).toBeCloseTo(8*PX_PER_MM);
 });
});
describe('view-only pagination in the actual editing engine',()=>{
 it('keeps block selection, document contents and undo intact when gaps change',()=>{
  const editor=BlockNoteEditor.create({schema,initialContent:[{id:'a',type:'paragraph',content:'first'},{id:'b',type:'paragraph',content:'second'}],extensions:[livePagination,blockSelection()]});
  const root=document.createElement('div');document.body.append(root);editor.mount(root);
  try{
   const original=editor.document;selectBlocks(editor,['a','b']);
   const view=editor.prosemirrorView;view.dispatch(view.state.tr.setMeta(paginationKey,[{pos:1,height:140,kind:'block'}]).setMeta('addToHistory',false));
   expect(root.querySelector('.paper-spacer').style.height).toBe('140px');expect(selectedBlockIds(editor)).toEqual(['a','b']);expect(editor.document).toEqual(original);
   editor.updateBlock('a',{content:'edited'});view.dispatch(view.state.tr.setMeta(paginationKey,[]).setMeta('addToHistory',false));editor.undo();expect(editor.document).toEqual(original);
  }finally{editor._tiptapEditor.destroy()}
 });
});
describe('PDF uses the live page layout',()=>{
 const source=()=>{const node=document.createElement('div');node.className='live-document';node.style.cssText='width:793.7px;padding:60px';node.innerHTML='<textarea id="document-title"></textarea><div class="page-tools">tools</div><div class="bn-editor" contenteditable="true"><div data-block-range-selected="true" style="background-color:blue">본문</div><div class="paper-spacer" data-paper-gap="block" style="height:148px"></div><p>다음 페이지</p></div>';document.body.append(node);return node};
 it('preserves measured gaps and text, strips controls/selection, and leaves live content untouched',async()=>{
  const node=source(),handles=document.createElement('div');handles.className='column-resize-layer';handles.innerHTML='<div role="separator">너비 조절</div>';node.append(handles);const before=node.outerHTML,copy=await freezeLiveSource(node,{title:'제목'});
  expect(copy.outerHTML).toContain('본문');expect(copy.outerHTML).toContain('148px');expect(copy.outerHTML).toContain('제목');expect(copy.outerHTML).not.toContain('data-block-range-selected');expect(copy.outerHTML).not.toContain('contenteditable');expect(copy.outerHTML).not.toContain('tools');expect(copy.outerHTML).not.toContain('column-resize-layer');expect(node.outerHTML).toBe(before);
 });
 it('retains the independently sized and wrapped page title in the PDF snapshot',async()=>{
  const node=source(),title=node.querySelector('#document-title');title.style.cssText='font-size:56px;height:135px;white-space:pre-wrap';
  const copy=await freezeLiveSource(node,{title:'독립된 페이지 제목',titleFontSize:42,fontSize:12}),printed=copy.querySelector('#document-title');
  expect(printed.tagName).toBe('DIV');expect(printed.style.fontSize).toBe('56px');expect(printed.style.height).toBe('135px');expect(printed.textContent).toBe('독립된 페이지 제목');
 });
 it('cuts the same live canvas into physical sheets without reflow and emits per-page numbering',async()=>{
  const metrics=pageMetrics({paper:'A4',pageNumber:'left'}),job=await livePrintJob(source(),{title:'제목',paper:'A4',pageNumber:'left'},{count:2,metrics});
  const doc=new DOMParser().parseFromString(job.html,'text/html');expect(doc.querySelectorAll('.printed-sheet')).toHaveLength(2);expect([...doc.querySelectorAll('.printed-page-number')].map(n=>n.textContent)).toEqual(['1/2','2/2']);expect(parseFloat(doc.querySelectorAll('.frozen-document')[1].style.top)).toBeCloseTo(-metrics.height-PAGE_GAP);expect(job.pageCount).toBe(2);expect(job.html).toContain('210mm 297mm');
 });
});
