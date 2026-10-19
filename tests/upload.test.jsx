import {expect,it} from 'vitest';
import {BlockNoteEditor} from '@blocknote/core';
import {schema} from '../src/blocks';
import {uploadLocalFile} from '../src/storage';

it('uploads a local image using the same partial-block contract as the file panel',async()=>{
 const file=new File(['image bytes'],'profile.png',{type:'image/png'});
 const editor=BlockNoteEditor.create({schema,initialContent:[{id:'image',type:'image'}],uploadFile:uploadLocalFile});
 try{
  const update=await editor.uploadFile(file,'image');editor.updateBlock('image',update);
  expect(editor.getBlock('image').props).toMatchObject({name:'profile.png',url:'data:image/png;base64,aW1hZ2UgYnl0ZXM='});
  const saved=structuredClone(editor.document);editor.replaceBlocks(editor.document,saved);
  expect(editor.getBlock('image').props.url).toBe(update.props.url);
 }finally{editor._tiptapEditor.destroy()}
});
