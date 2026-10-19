import {afterEach,it,expect} from 'vitest';
import {BlockNoteEditor} from '@blocknote/core';
import {TextSelection} from 'prosemirror-state';
import {schema} from '../src/blocks';
import {blockSelection,selectBlocks} from '../src/block-selection';
import {blockAppearance,setBlockSpacing,adjustBlockSpacing,setLinkColor,formatTargets} from '../src/block-format';
import {saveDocument,loadDocument,emptyDocument,migrateDocument} from '../src/storage';
import {pageSettings,pageVariables} from '../src/page-settings';

const editors=[];
function create(blocks){const editor=BlockNoteEditor.create({schema,initialContent:blocks,extensions:[blockSelection(),blockAppearance]});const root=document.createElement('div');document.body.append(root);editor.mount(root);editors.push(editor);return editor}
afterEach(()=>{editors.splice(0).forEach(e=>e._tiptapEditor.destroy());document.body.replaceChildren()});

it('applies spacing to a noncontiguous selection in one undo step and preserves it in storage and copied HTML',async()=>{
 const e=create([{id:'a',type:'paragraph',content:'A'},{id:'b',type:'paragraph',content:'B'},{id:'c',type:'divider'}]);
 selectBlocks(e,['a','c']);expect(formatTargets(e).map(b=>b.id)).toEqual(['a','c']);
 const before=e.document;setBlockSpacing(e,['a','c'],{spaceBefore:10,spaceAfter:18});
 expect(e.getBlock('a').props).toMatchObject({spaceBefore:10,spaceAfter:18});expect(e.getBlock('b').props.spaceBefore).toBe(-1);
 const parsed=e.tryParseHTMLToBlocks(e.blocksToFullHTML(e.document));expect(parsed[0].props.spaceAfter).toBe(18);expect(parsed[2].props.spaceBefore).toBe(10);
 await saveDocument({...emptyDocument(),blocks:e.document});expect((await loadDocument()).blocks).toEqual(e.document);
 e.undo();expect(e.document).toEqual(before);e.redo();expect(e.getBlock('c').props.spaceAfter).toBe(18);
 setBlockSpacing(e,['a','c'],{spaceBefore:-1,spaceAfter:-1});expect(e.getBlock('c').props.spaceAfter).toBe(-1);
});
it('keeps image alignment, width and block spacing together across undo and serialized HTML',()=>{
 const e=create([{id:'image',type:'image',props:{url:'data:image/png;base64,YQ==',previewWidth:160}}]);
 e.updateBlock('image',{props:{textAlignment:'center'}});setBlockSpacing(e,['image'],{spaceBefore:12});
 const p=e.tryParseHTMLToBlocks(e.blocksToFullHTML(e.document))[0].props;
 expect(p).toMatchObject({textAlignment:'center',previewWidth:160,spaceBefore:12});
 e.undo();expect(e.getBlock('image').props.textAlignment).toBe('center');expect(e.getBlock('image').props.spaceBefore).toBe(-1);
});
it('uses selected block IDs for keyboard spacing adjustments without editing other blocks',()=>{
 const e=create([{id:'a',type:'paragraph',content:'A'},{id:'b',type:'paragraph',content:'B'}]);selectBlocks(e,['a']);
 adjustBlockSpacing(e,'spaceAfter',2);expect(e.getBlock('a').props.spaceAfter).toBe(2);expect(e.getBlock('b').props.spaceAfter).toBe(-1);
 adjustBlockSpacing(e,'spaceAfter',-4);expect(e.getBlock('a').props.spaceAfter).toBe(0);
 e.isEditable=false;expect(setBlockSpacing(e,['a'],{spaceAfter:10})).toBe(false);
});
it('routes spacing shortcut keys to all selected blocks before arrow navigation clears the selection',()=>{
 const e=create([{id:'a',type:'paragraph',content:'A'},{id:'b',type:'paragraph',content:'B'},{id:'c',type:'paragraph',content:'C'}]);selectBlocks(e,['a','c']);
 const view=e.prosemirrorView,event=new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',ctrlKey:true,altKey:true,bubbles:true,cancelable:true});
 view.someProp('handleKeyDown',handler=>handler(view,event));
 expect(e.getBlock('a').props.spaceAfter).toBe(2);expect(e.getBlock('c').props.spaceAfter).toBe(2);expect(e.getBlock('b').props.spaceAfter).toBe(-1);
});
it('colors only linked text in a mixed selection and restores the default without losing the URL',()=>{
 const e=create([{id:'a',type:'paragraph',content:[{type:'text',text:'plain ',styles:{}},{type:'link',href:'https://example.com',content:[{type:'text',text:'linked',styles:{bold:true}}]},{type:'text',text:' end',styles:{}}]}]);
 e.setTextCursorPosition('a','start');const from=e.prosemirrorState.selection.from;
 e.prosemirrorView.dispatch(e.prosemirrorState.tr.setSelection(TextSelection.create(e.prosemirrorState.doc,from,from+16)));
 expect(setLinkColor(e,'purple')).toBe(true);
 const parts=e.getBlock('a').content;expect(parts[0].styles.textColor).toBeUndefined();expect(parts[1].href).toBe('https://example.com');expect(parts[1].content[0].styles).toMatchObject({bold:true,textColor:'purple'});
 e.undo();expect(e.getBlock('a').content[1].content[0].styles.textColor).toBeUndefined();e.redo();
 e.prosemirrorView.dispatch(e.prosemirrorState.tr.setSelection(TextSelection.create(e.prosemirrorState.doc,from+8)));
 expect(setLinkColor(e,'default')).toBe(true);expect(e.getBlock('a').content[1].href).toBe('https://example.com');expect(e.getBlock('a').content[1].content[0].styles).toEqual({bold:true});
});
it('validates master typography, inherits old defaults, and normalizes unsafe imported spacing',()=>{
 expect(pageSettings({lineHeight:100,letterSpacing:-20,blockGap:100,linkColor:'url(evil)'})).toMatchObject({lineHeight:3,letterSpacing:-1,blockGap:48,linkColor:'#2365a8'});
 const doc=migrateDocument({blocks:[{type:'paragraph',props:{spaceBefore:999,spaceAfter:'bad'},content:'old'}]});
 expect(doc).toMatchObject({lineHeight:1.5,letterSpacing:0,blockGap:0});expect(doc.blocks[0].props).toMatchObject({spaceBefore:96,spaceAfter:-1});
 expect(pageVariables({lineHeight:1.8,letterSpacing:.3,blockGap:4,linkColor:'#008800'})).toMatchObject({'--body-line-height':'1.8','--body-letter-spacing':'0.3pt','--block-gap':'4pt','--link-color':'#008800'});
});
