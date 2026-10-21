import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it} from 'vitest';
import {MantineProvider} from '@mantine/core';
import {BlockNoteEditor} from '@blocknote/core';
import {BlockNoteView} from '@blocknote/mantine';
import {schema} from '../src/blocks';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const cleanups=[];
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());document.body.replaceChildren()});
it('shows the current expression when the editor is opened after an external change such as undo',async()=>{
 const editor=BlockNoteEditor.create({schema,initialContent:[{id:'e',type:'equation',props:{expression:'a'}}]}),node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 cleanups.push(()=>{act(()=>root.unmount());editor._tiptapEditor.destroy()});
 await act(async()=>{root.render(<MantineProvider env="test"><BlockNoteView editor={editor} sideMenu={false} slashMenu={false} formattingToolbar={false}/></MantineProvider>)});
 await act(async()=>{editor.updateBlock('e',{props:{expression:'b'}})});
 await act(async()=>node.querySelector('.math-button').click());
 expect(node.querySelector('textarea[aria-label="LaTeX 수식"]').value).toBe('b');
});
