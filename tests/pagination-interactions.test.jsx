import {afterEach,it,expect,vi} from 'vitest';
import {BlockNoteEditor} from '@blocknote/core';
import {schema} from '../src/blocks';
import {createLivePaginator,livePagination,paginateLiveDOM} from '../src/live-pagination';
import {blockAppearance} from '../src/block-format';
import {pageMetrics} from '../src/page-settings';

let cleanup=[];
afterEach(()=>{cleanup.splice(0).reverse().forEach(fn=>fn());vi.useRealTimers();vi.restoreAllMocks();document.body.replaceChildren()});
function create(){
 const editor=BlockNoteEditor.create({schema,extensions:[blockAppearance,livePagination],initialContent:[{id:'image',type:'image',props:{url:'data:image/png;base64,YQ==',previewWidth:160}},{id:'text',type:'paragraph',content:'본문'}]}),source=document.createElement('div');
 document.body.append(source);editor.mount(source);cleanup.push(()=>editor._tiptapEditor.destroy());
 return {editor,source};
}
it('ignores image handle hover and repeated load events without repainting the document',async()=>{
 vi.useFakeTimers();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 const {editor,source}=create(),paginator=createLivePaginator({editor,source,getMeta:()=>({paper:'A4'}),onLayout:()=>{},onState:()=>{}});cleanup.push(()=>paginator.destroy());
 await vi.advanceTimersByTimeAsync(200);
 const dispatch=vi.spyOn(editor.prosemirrorView,'dispatch');
 const handle=source.querySelector('.bn-resize-handle');handle.style.display='block';handle.style.display='none';
 source.querySelector('img').dispatchEvent(new Event('load'));
 await vi.advanceTimersByTimeAsync(400);expect(dispatch).not.toHaveBeenCalled();
});
it('defers pagination until media resizing finishes and resumes after mouseup',async()=>{
 vi.useFakeTimers();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 const {editor,source}=create(),onLayout=vi.fn(),paginator=createLivePaginator({editor,source,getMeta:()=>({paper:'A4'}),onLayout,onState:()=>{}});cleanup.push(()=>paginator.destroy());
 vi.spyOn(editor.prosemirrorView,'posAtCoords').mockReturnValue(null);
 source.querySelector('.bn-resize-handle').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
 await vi.advanceTimersByTimeAsync(200);expect(onLayout).not.toHaveBeenCalled();
 document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));await vi.advanceTimersByTimeAsync(200);expect(onLayout).toHaveBeenCalledOnce();
});
it('yields during pagination and discards a calculation superseded by document editing',async()=>{
 const {editor,source}=create(),view=editor.prosemirrorView,metrics=pageMetrics({paper:'A4'});
 const box=(top,height)=>({x:0,y:top,left:0,top,bottom:top+height,right:700,width:700,height});
 vi.spyOn(source,'getBoundingClientRect').mockReturnValue(box(0,1800));
 vi.spyOn(view.dom,'getBoundingClientRect').mockReturnValue(box(metrics.top,1800));
 const content=source.querySelector('[data-content-type="image"]'),outer=content.closest('.bn-block-outer');
 outer.getClientRects=()=>[box(metrics.height-50,100)];content.getClientRects=()=>[box(metrics.height-50,100)];
 vi.spyOn(content,'getBoundingClientRect').mockReturnValue(box(metrics.height-50,100));
 let tick=0;vi.spyOn(performance,'now').mockImplementation(()=>tick+=20);
 const initial=view.state.doc,yieldToUI=vi.fn(async()=>editor.updateBlock('text',{content:'edited while computing'}));
 const result=await paginateLiveDOM(view,source,metrics,()=>view.state.doc!==initial,yieldToUI);
 expect(yieldToUI).toHaveBeenCalledOnce();expect(result).toBeNull();expect(editor.getBlock('text').content[0].text).toBe('edited while computing');
});
