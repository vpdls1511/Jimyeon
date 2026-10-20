import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {MantineProvider} from '@mantine/core';
import {BlockNoteEditor} from '@blocknote/core';
import {SideMenuExtension} from '@blocknote/core/extensions';
import {BlockNoteView} from '@blocknote/mantine';
import {NotionSideMenu} from '../src/menus';
import {schema} from '../src/blocks';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const cleanups=[];
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());document.body.replaceChildren()});
async function fixture(){
 const editor=BlockNoteEditor.create({schema,initialContent:[{id:'divider',type:'divider'}]}),side=editor.getExtension(SideMenuExtension),unfreeze=vi.spyOn(side,'unfreezeMenu');
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 cleanups.push(()=>{act(()=>root.unmount());editor._tiptapEditor.destroy()});
 await act(async()=>{root.render(<MantineProvider env="test"><BlockNoteView editor={editor} sideMenu={false} slashMenu={false} formattingToolbar={false}><NotionSideMenu/></BlockNoteView></MantineProvider>)});
 act(()=>side.store.setState({...side.store.state,block:editor.document[0],show:true}));
 const trigger=node.querySelector('[data-test="dragHandle"]').closest('button');
 await act(async()=>trigger.click());
 expect(trigger.getAttribute('aria-expanded')).toBe('true');return {editor,side,node,trigger,unfreeze};
}
it('closes on an outside pointer press even when editor handlers stop propagation',async()=>{
 const {node,trigger,unfreeze}=await fixture();const outside=document.createElement('button');node.append(outside);outside.addEventListener('pointerdown',event=>event.stopPropagation());
 act(()=>outside.dispatchEvent(new Event('pointerdown',{bubbles:true})));expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(unfreeze).toHaveBeenCalled();
});
it('keeps menu controls usable and closes when clicking elsewhere or pressing Escape',async()=>{
 const {node,trigger,editor}=await fixture();const slider=node.querySelector('input[aria-label="구분선 불투명도"]');expect(slider).not.toBeNull();
 act(()=>{slider.dispatchEvent(new Event('pointerdown',{bubbles:true}));slider.click()});expect(trigger.getAttribute('aria-expanded')).toBe('true');
 act(()=>document.body.click());expect(trigger.getAttribute('aria-expanded')).toBe('false');
 await act(async()=>trigger.click());expect(trigger.getAttribute('aria-expanded')).toBe('true');
 const dropdown=node.querySelector('[role="menu"]');act(()=>dropdown.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(trigger.getAttribute('aria-expanded')).toBe('false');expect(editor.getBlock('divider').type).toBe('divider');
});
