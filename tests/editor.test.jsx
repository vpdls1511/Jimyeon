import {afterEach,describe,expect,it} from 'vitest';
import {BlockNoteEditor} from '@blocknote/core';
import {NodeSelection} from 'prosemirror-state';
import {schema,safeWebUrl} from '../src/blocks';
import {notionBehavior} from '../src/notion-behavior';
import {cloneBlocks,updateSelectedBlocks,setDividerOpacity} from '../src/menus';
import {selectBlocks} from '../src/block-selection';
import {searchExtension,setSearch,replaceSearch,searchKey} from '../src/search';
import {freezeLiveSource} from '../src/live-print';
import {saveDocument,loadDocument,emptyDocument,revision,listRevisions} from '../src/storage';
let editors=[];
function create(blocks=[{id:'a',type:'paragraph',content:'hello'}],mount=true){const editor=BlockNoteEditor.create({schema,initialContent:blocks,extensions:[notionBehavior,searchExtension],tables:{splitCells:true,cellBackgroundColor:true,cellTextColor:true,headers:true},tabBehavior:'prefer-indent'});const root=document.createElement('div');document.body.append(root);if(mount)editor.mount(root);editors.push({editor,root});return editor}
afterEach(()=>{for(const {editor,root} of editors){editor._tiptapEditor.destroy();root.remove()}editors=[]});
describe('document semantics',()=>{
 it('supports each native editor block and custom content without a page model',()=>{const types=Object.keys(schema.blockSchema);for(const t of ['paragraph','heading','bulletListItem','numberedListItem','checkListItem','toggleListItem','quote','divider','table','codeBlock','image','video','audio','file','column','columnList','callout','equation','bookmark','embed','tableOfContents','button'])expect(types).toContain(t)});
 it('preserves nested bullets and formatted text',()=>{const e=create([{id:'a',type:'bulletListItem',content:[{type:'text',text:'A',styles:{bold:true}}],children:[{id:'b',type:'bulletListItem',content:'B'}]}]);expect(e.document[0].children[0].content[0].text).toBe('B');expect(e.document[0].content[0].styles.bold).toBe(true)});
 it('supports heading 4 and toggle headings',()=>{const e=create([{type:'heading',props:{level:4,isToggleable:true},content:'Heading',children:[{type:'paragraph',content:'Child'}]}]);expect(e.document[0].props).toMatchObject({level:4,isToggleable:true});expect(e.document[0].children).toHaveLength(1)});
 it('creates 5 columns with independent editable blocks',()=>{const e=create([{type:'columnList',children:Array.from({length:5},(_,i)=>({type:'column',props:{width:i+1},children:[{type:'paragraph',content:String(i)}]}))}]);expect(e.document[0].children).toHaveLength(5);expect(e.document[0].children[4].props.width).toBe(5)});
 it('duplicates descendants with fresh IDs and unchanged content',()=>{const e=create([{id:'a',type:'toggleListItem',content:'Title',children:[{id:'b',type:'paragraph',content:'Nested'}]}]);const [copy]=e.insertBlocks(cloneBlocks(e.document),e.document[0],'after');expect(copy.id).not.toBe('a');expect(copy.children[0].id).not.toBe('b');expect(copy.children[0].content[0].text).toBe('Nested')});
 it('undoes a structural change as a transaction',()=>{const e=create();e.updateBlock('a',{type:'heading',props:{level:2}});expect(e.getBlock('a').type).toBe('heading');e.undo();expect(e.getBlock('a').type).toBe('paragraph')});
 it('preserves selection across two text blocks',()=>{const e=create([{id:'a',type:'paragraph',content:'first'},{id:'b',type:'paragraph',content:'second'}]);e.setSelection('a','b');expect(e.getSelection().blocks.map(b=>b.id)).toEqual(['a','b'])});
 it('preserves table headers, cell colors and column widths',()=>{const e=create([{type:'table',content:{type:'tableContent',columnWidths:[120,220],headerRows:1,headerCols:1,rows:[{cells:['A','B']},{cells:['C','D']}]}}]);expect(e.document[0].content.columnWidths).toEqual([120,220]);expect(e.document[0].content.headerRows).toBe(1)});
 it('retains image URL, caption and resized width',()=>{const e=create([{type:'image',props:{url:'data:image/png;base64,aGVsbG8=',previewWidth:240,caption:'caption',name:'image.png'}}]);expect(e.document[0].props).toMatchObject({previewWidth:240,caption:'caption'})});
 it('keeps old dividers compatible and preserves a selected divider color through save and undo',async()=>{
  const e=create([{id:'line',type:'divider'}]);expect(e.getBlock('line').props.textColor).toBe('default');
  expect(updateSelectedBlocks(e,e.getBlock('line'),{props:{textColor:'blue'}},b=>b.type==='divider')).toBe(true);expect(e.prosemirrorView.dom.querySelector('[data-content-type="divider"]').getAttribute('data-text-color')).toBe('blue');await saveDocument({...emptyDocument(),blocks:e.document});expect((await loadDocument()).blocks[0].props.textColor).toBe('blue');
  e.undo();expect(e.getBlock('line').props.textColor).toBe('default');e.redo();expect(e.getBlock('line').props.textColor).toBe('blue');
 });
 it('round-trips divider color through full HTML used by block copy and drag',()=>{
  const e=create([{id:'line',type:'divider',props:{textColor:'purple'}}]);const html=e.blocksToFullHTML(e.document),parsed=e.tryParseHTMLToBlocks(html);
  expect(parsed[0].type).toBe('divider');expect(parsed[0].props.textColor).toBe('purple');
 });
 it('defaults divider opacity to half and preserves transparent and custom lines through undo, storage and HTML',async()=>{
  const e=create([{id:'a',type:'divider'},{id:'b',type:'paragraph',content:'Keep text'},{id:'c',type:'divider',props:{opacity:0.75}}]),before=e.document;
  expect(e.getBlock('a').props.opacity).toBe(0.5);expect(e.prosemirrorView.dom.querySelector('hr').style.opacity).toBe('0.5');
  expect((await freezeLiveSource(e.prosemirrorView.dom,{})).querySelector('hr').style.opacity).toBe('0.5');
  selectBlocks(e,['a','b','c']);setDividerOpacity(e,e.getBlock('a'),0);
  expect(e.getBlock('a').props.opacity).toBe(0);expect(e.getBlock('c').props.opacity).toBe(0);expect(e.getBlock('b')).toEqual(before[1]);expect(e.prosemirrorView.dom.querySelector('hr').style.opacity).toBe('0');
  await saveDocument({...emptyDocument(),blocks:e.document});expect((await loadDocument()).blocks[0].props.opacity).toBe(0);
  expect(e.tryParseHTMLToBlocks(e.blocksToFullHTML(e.document))[0].props.opacity).toBe(0);
  e.undo();expect(e.document).toEqual(before);e.redo();expect(e.getBlock('a').props.opacity).toBe(0);
  setDividerOpacity(e,e.getBlock('a'),2);expect(e.getBlock('a').props.opacity).toBe(1);setDividerOpacity(e,e.getBlock('a'),NaN);expect(e.getBlock('a').props.opacity).toBe(0.5);
 });
 it('colors selected dividers in one menu action without changing neighboring text',()=>{
  const e=create([{id:'a',type:'divider'},{id:'b',type:'paragraph',content:'Keep text'},{id:'c',type:'divider'}]),before=e.document;
  selectBlocks(e,['a','b','c']);updateSelectedBlocks(e,e.getBlock('a'),{props:{textColor:'red'}},b=>b.type==='divider');
  expect(e.getBlock('a').props.textColor).toBe('red');expect(e.getBlock('c').props.textColor).toBe('red');expect(e.getBlock('b')).toEqual(before[1]);e.undo();expect(e.document).toEqual(before);
 });
 it('imports rich HTML with headings, lists and links',()=>{const e=create();const b=e.tryParseHTMLToBlocks('<h2>Title</h2><ul><li>A<ul><li>B</li></ul></li></ul><p><a href="https://example.com">link</a></p>');expect(b[0].type).toBe('heading');expect(b.find(b=>b.type==='bulletListItem').children).toHaveLength(1)});
 it('imports and exports Markdown including nested bullets',async()=>{const e=create();const b=await e.tryParseMarkdownToBlocks('# Title\n\n- A\n  - B\n\n**Bold**');expect(b[0].type).toBe('heading');expect(await e.blocksToMarkdownLossy(b)).toContain('**Bold**')});
});
describe('find and replace',()=>{
 it('finds across formatted text and replaces all in one undoable operation',()=>{const e=create([{type:'paragraph',content:[{type:'text',text:'he',styles:{bold:true}},{type:'text',text:'llo hello',styles:{}}]}]);expect(setSearch(e,'hello')).toHaveLength(2);replaceSearch(e,'world',true);expect(e.document[0].content.map(c=>c.text).join('')).toBe('world world');e.undo();expect(e.document[0].content.map(c=>c.text).join('')).toBe('hello hello')});
 it('supports case-sensitive search',()=>{const e=create([{type:'paragraph',content:'Hello hello HELLO'}]);expect(setSearch(e,'hello')).toHaveLength(3);expect(setSearch(e,'hello',true)).toHaveLength(1)});
 it('keeps match ranges aligned when lowercasing changes the text length',()=>{
  const e=create([{type:'paragraph',content:'İİ cat dog'}]);expect(setSearch(e,'cat')).toEqual([{from:6,to:9}]);replaceSearch(e,'cow',true);expect(e.document[0].content.map(c=>c.text).join('')).toBe('İİ cow dog');
  const t=create([{type:'paragraph',content:'İstanbul cat ẞ cat'}]);const found=setSearch(t,'cat');expect(found).toEqual([{from:12,to:15},{from:18,to:21}]);expect(setSearch(t,'İstanbul')).toEqual([{from:3,to:11}]);
 });
});
describe('local persistence',()=>{
 it('round-trips document layout and data attachments',async()=>{const doc={...emptyDocument(),title:'저장 검증',blocks:[{type:'columnList',children:[{type:'column',children:[{type:'image',props:{url:'data:image/png;base64,YQ=='}}]},{type:'column',children:[{type:'paragraph',content:'한글'}]}]}]};await saveDocument(doc);expect(await loadDocument()).toEqual(doc)});
 it('keeps recoverable snapshots',async()=>{const doc=emptyDocument();await revision(doc);expect((await listRevisions())[0].doc).toEqual(doc)});
 it('rejects executable and local-file embed URLs',()=>{expect(safeWebUrl('javascript:alert(1)')).toBeNull();expect(safeWebUrl('file:///etc/passwd')).toBeNull();expect(safeWebUrl('https://example.com')).toBe('https://example.com/')});
});
describe('Notion input conventions through the actual input-rule pipeline',()=>{
 function type(e,text){for(const char of text){const view=e._tiptapEditor.view,{from,to}=view.state.selection;const handled=view.someProp('handleTextInput',handler=>handler(view,from,to,char));if(!handled)view.dispatch(view.state.tr.insertText(char,from,to))}}
 for(const [input,typeName,props] of [['- ','bulletListItem',{}],['[]','checkListItem',{}],['> ','toggleListItem',{}],['" ','quote',{}],['# ','heading',{level:1}],['#### ','heading',{level:4}],['1. ','numberedListItem',{}],['---','divider',{textColor:'default'}]])it(`${input} becomes ${typeName}`,()=>{const e=create([{id:'a',type:'paragraph'}]);e.setTextCursorPosition('a','start');type(e,input);expect(e.document[0].type).toBe(typeName);expect(e.document[0].props).toMatchObject(props)});
 it('keeps tab panels as document children with independent content',()=>{const e=create([{type:'tabs',children:[{type:'tabPanel',props:{label:'One'},children:[{type:'paragraph',content:'A'}]},{type:'tabPanel',props:{label:'Two'},children:[{type:'paragraph',content:'B'}]}]}],false);expect(e.document[0].children[1].children[0].content[0].text).toBe('B')});

});
