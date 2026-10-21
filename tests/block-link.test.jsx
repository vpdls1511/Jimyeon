import {afterEach,describe,expect,it} from 'vitest';
import {BlockNoteEditor} from '@blocknote/core';
import {schema} from '../src/blocks';
import {goToBlockHash} from '../src/block-link';
let cleanup=[];
afterEach(()=>{cleanup.splice(0).forEach(fn=>fn())});
function create(){const editor=BlockNoteEditor.create({schema,initialContent:[{id:'a',type:'paragraph',content:'first'},{id:'b',type:'paragraph',content:'second'}]}),root=document.createElement('div');document.body.append(root);editor.mount(root);cleanup.push(()=>{editor._tiptapEditor.destroy();root.remove()});return editor}
describe('block links',()=>{
 it('moves the cursor to the block named by a #block-<id> hash',()=>{
  const e=create();window.Element.prototype.scrollIntoView=function(){};
  expect(goToBlockHash(e,'#block-b')).toBe(true);expect(e.getTextCursorPosition().block.id).toBe('b');
  expect(goToBlockHash(e,'#block-a')).toBe(true);expect(e.getTextCursorPosition().block.id).toBe('a');
 });
 it('ignores unrelated hashes and unknown blocks',()=>{
  const e=create();expect(goToBlockHash(e,'')).toBe(false);expect(goToBlockHash(e,'#top')).toBe(false);expect(goToBlockHash(e,'#block-missing')).toBe(false);expect(goToBlockHash(e,'#block-%E0%A4%A')).toBe(false);
 });
});
