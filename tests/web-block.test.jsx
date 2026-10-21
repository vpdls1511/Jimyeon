import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {MantineProvider} from '@mantine/core';
import {BlockNoteEditor} from '@blocknote/core';
import {BlockNoteView} from '@blocknote/mantine';
import {schema} from '../src/blocks';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const cleanups=[];
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());document.body.replaceChildren();vi.restoreAllMocks()});
async function mount(initialContent){
 const editor=BlockNoteEditor.create({schema,initialContent}),node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 cleanups.push(()=>{act(()=>root.unmount());editor._tiptapEditor.destroy()});
 await act(async()=>{root.render(<MantineProvider env="test"><BlockNoteView editor={editor} sideMenu={false} slashMenu={false} formattingToolbar={false}/></MantineProvider>)});
 return node;
}
it('keeps the editor alive and shows the address input for a bookmark whose URL is not http(s)',async()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});
 const node=await mount([{id:'a',type:'bookmark',props:{url:'example.com'}},{id:'b',type:'bookmark',props:{url:'javascript:alert(1)'}},{id:'c',type:'bookmark',props:{url:'https://example.com/a'}}]);
 const blocks=[...node.querySelectorAll('.web-block')];
 expect(blocks).toHaveLength(3);
 expect(blocks[0].querySelector('input[aria-label="웹 주소"]').value).toBe('example.com');
 expect(blocks[1].querySelector('input[aria-label="웹 주소"]')).not.toBeNull();
 expect(blocks[2].querySelector('a.bookmark small').textContent).toContain('example.com');
});
