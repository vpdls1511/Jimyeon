import {afterEach,expect,it} from 'vitest';
import {BlockNoteEditor} from '@blocknote/core';
import {schema} from '../src/blocks';
import {uploadLocalFile,emptyDocument} from '../src/storage';

afterEach(()=>{delete window.desktop});

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
it('refuses a desktop attachment before reading it when the document would pass the 100MB save limit',async()=>{
 window.desktop={};const video={name:'영상.mp4',type:'video/mp4',size:80*1024*1024};
 await expect(uploadLocalFile(video,emptyDocument())).rejects.toThrow('100MB');
 // What the document already holds counts too, not only the new file.
 const large={...emptyDocument(),blocks:[{type:'paragraph',content:'a'.repeat(50*1024*1024)}]};
 await expect(uploadLocalFile({...video,size:40*1024*1024},large)).rejects.toThrow('100MB');
 expect((await uploadLocalFile(new File(['image bytes'],'profile.png',{type:'image/png'}),large)).props.url).toBe('data:image/png;base64,aW1hZ2UgYnl0ZXM=');
});
