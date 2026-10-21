import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MantineProvider} from '@mantine/core';
import {BlockNoteEditor} from '@blocknote/core';
import {BlockNoteView} from '@blocknote/mantine';
import {schema} from '../src/blocks';
import {extraSlashItems} from '../src/menus';
import {editingConventions} from '../src/editing-conventions';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const cleanups=[];
// The desktop app replaces window.prompt with a function that always throws.
beforeEach(()=>vi.stubGlobal('prompt',()=>{throw Error('prompt() is not supported.')}));
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());vi.unstubAllGlobals();document.body.replaceChildren()});
async function mount(blocks){
 const editor=BlockNoteEditor.create({schema,initialContent:blocks,extensions:[editingConventions]}),node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 cleanups.push(()=>{act(()=>root.unmount());editor._tiptapEditor.destroy()});
 await act(async()=>{root.render(<MantineProvider env="test"><BlockNoteView editor={editor} sideMenu={false} slashMenu={false} formattingToolbar={false}/></MantineProvider>)});
 return {editor,node};
}
const key=(target,name,init={})=>act(()=>{target.dispatchEvent(new KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true,...init}))});
const type=(input,value)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))});
const dblclick=target=>act(()=>{target.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))});
const equations=editor=>editor.getBlock('a').content.filter(c=>c.type==='inlineEquation').map(c=>c.props.expression);
const field=(node,label)=>node.querySelector(`input[aria-label="${label}"]`);

it('adds an inline equation from the slash menu with Enter, and Escape leaves the document unchanged',async()=>{
 const {editor,node}=await mount([{id:'a',type:'paragraph',content:'x'}]),before=editor.document,item=extraSlashItems(editor).find(i=>i.title==='인라인 수식');
 editor.setTextCursorPosition('a','end');await act(async()=>item.onItemClick());
 let input=field(node,'LaTeX 수식');expect(input).not.toBeNull();expect(document.activeElement).toBe(input);
 key(input,'Escape');expect(field(node,'LaTeX 수식')).toBeNull();expect(editor.document).toEqual(before);
 editor.setTextCursorPosition('a','end');await act(async()=>item.onItemClick());
 key(field(node,'LaTeX 수식'),'Enter');expect(field(node,'LaTeX 수식')).toBeNull();expect(editor.document).toEqual(before);
 editor.setTextCursorPosition('a','end');await act(async()=>item.onItemClick());
 input=field(node,'LaTeX 수식');type(input,'x^2');key(input,'Enter');
 expect(field(node,'LaTeX 수식')).toBeNull();expect(equations(editor)).toEqual(['x^2']);expect(editor.document).toHaveLength(1);
});

it('keeps a new inline equation out of undo history until it is applied, then undoes it in one step',async()=>{
 // History merges changes made within 500ms, so space the steps out like a person would.
 vi.useFakeTimers({toFake:['Date']});cleanups.push(()=>vi.useRealTimers());const later=()=>vi.setSystemTime(Date.now()+1000);
 const {editor,node}=await mount([{id:'a',type:'paragraph',content:'x'}]),item=extraSlashItems(editor).find(i=>i.title==='인라인 수식');
 editor.setTextCursorPosition('a','end');editor.insertInlineContent('y');const typed=editor.document;later();
 await act(async()=>item.onItemClick());later();key(field(node,'LaTeX 수식'),'Escape');later();expect(editor.document).toEqual(typed);
 act(()=>editor.undo());expect(editor.getBlock('a').content).toEqual([{type:'text',text:'x',styles:{}}]);expect(field(node,'LaTeX 수식')).toBeNull();
 editor.setTextCursorPosition('a','end');const before=editor.document;later();
 await act(async()=>item.onItemClick());later();const input=field(node,'LaTeX 수식');type(input,'x^2');later();key(input,'Enter');expect(equations(editor)).toEqual(['x^2']);later();
 act(()=>editor.undo());expect(editor.document).toEqual(before);expect(field(node,'LaTeX 수식')).toBeNull();
});

it('leaves empty equations already in a document closed, keeps them on Escape or an empty Enter and exports only the formula',async()=>{
 const {editor,node}=await mount([{id:'a',type:'paragraph',content:['f ',{type:'inlineEquation',props:{expression:''}},' g ',{type:'inlineEquation',props:{expression:''}}]}]),before=editor.document;
 await act(async()=>{});expect(field(node,'LaTeX 수식')).toBeNull();expect(document.activeElement).toBe(document.body);
 for(const name of ['Escape','Enter']){dblclick(node.querySelector('.inline-equation'));key(field(node,'LaTeX 수식'),name);expect(field(node,'LaTeX 수식')).toBeNull();expect(editor.document).toEqual(before)}
 for(const html of [await editor.blocksToHTMLLossy(editor.document),await editor.blocksToFullHTML(editor.document)])expect(html).not.toContain('<input');
});

it('edits an inline equation in place on double-click and keeps it on Escape or an empty Enter',async()=>{
 const {editor,node}=await mount([{id:'a',type:'paragraph',content:['f ',{type:'inlineEquation',props:{expression:'a+b'}}]}]);
 dblclick(node.querySelector('.inline-equation'));let input=field(node,'LaTeX 수식');expect(input.value).toBe('a+b');
 type(input,'c');key(input,'Escape');expect(field(node,'LaTeX 수식')).toBeNull();expect(equations(editor)).toEqual(['a+b']);
 dblclick(node.querySelector('.inline-equation'));input=field(node,'LaTeX 수식');
 type(input,'');key(input,'Enter');expect(field(node,'LaTeX 수식')).toBeNull();expect(equations(editor)).toEqual(['a+b']);
 dblclick(node.querySelector('.inline-equation'));input=field(node,'LaTeX 수식');expect(input.value).toBe('a+b');
 type(input,'c');key(input,'Enter');expect(equations(editor)).toEqual(['c']);expect(editor.document).toHaveLength(1);
});

it('renames a tab in place, ignoring Enter while composing and keeping the name on Escape',async()=>{
 const {editor,node}=await mount([{id:'t',type:'tabs',children:[{type:'tabPanel',props:{label:'탭 1'},children:[{type:'paragraph'}]},{type:'tabPanel',props:{label:'탭 2'},children:[{type:'paragraph'}]}]}]);
 const tab=()=>[...node.querySelectorAll('.tabs-bar button')].find(b=>b.textContent==='탭 1'||b.textContent==='개요');
 dblclick(tab());let input=field(node,'탭 이름');expect(input.value).toBe('탭 1');
 type(input,'다른 이름');key(input,'Escape');expect(field(node,'탭 이름')).toBeNull();expect(editor.getBlock('t').children[0].props.label).toBe('탭 1');
 dblclick(tab());input=field(node,'탭 이름');type(input,'개요');key(input,'Enter',{isComposing:true});expect(field(node,'탭 이름')).not.toBeNull();expect(editor.getBlock('t').children[0].props.label).toBe('탭 1');
 key(input,'Enter');expect(field(node,'탭 이름')).toBeNull();expect(editor.getBlock('t').children.map(t=>t.props.label)).toEqual(['개요','탭 2']);
});

it('keeps editor shortcuts from acting on the document while typing in the input',async()=>{
 const {editor,node}=await mount([{id:'a',type:'paragraph',content:['f ',{type:'inlineEquation',props:{expression:'a'}}]},{id:'b',type:'paragraph',content:'b'}]);
 const seen=vi.fn();window.addEventListener('keydown',seen);cleanups.push(()=>window.removeEventListener('keydown',seen));
 editor.setTextCursorPosition('a','start');dblclick(node.querySelector('.inline-equation'));const input=field(node,'LaTeX 수식');
 key(input,'1',{ctrlKey:true,altKey:true});expect(editor.getBlock('a').type).toBe('paragraph');expect(field(node,'LaTeX 수식')).toBe(input);
 type(input,'a^2');key(input,'Enter');expect(equations(editor)).toEqual(['a^2']);expect(editor.document).toHaveLength(2);
 // Enter and Escape stay with the input instead of reaching app-wide key handlers.
 expect(seen.mock.calls.map(([event])=>event.key)).toEqual(['1']);
 key(editor.prosemirrorView.dom,'1',{ctrlKey:true,altKey:true});expect(editor.getBlock('a').type).toBe('heading');
});
