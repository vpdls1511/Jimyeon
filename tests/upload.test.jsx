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
it('counts the indented document file size so a document that attaches can still be saved as a file',async()=>{
 window.desktop={};const doc={...emptyDocument(),blocks:Array.from({length:200000},()=>({type:'paragraph'}))};
 const compact=JSON.stringify(doc).length,indented=JSON.stringify(doc,null,2).length,limit=100*1024*1024;
 // The data URL leaves the compact size under the limit but the indented file over it.
 const encoded=limit-Math.round((compact+indented)/2),video={name:'영상.mp4',type:'video/mp4',size:Math.floor(encoded/4)*3};
 expect(compact+Math.ceil(video.size/3)*4+100).toBeLessThan(limit);expect(indented+Math.ceil(video.size/3)*4).toBeGreaterThan(limit);
 await expect(uploadLocalFile(video,doc)).rejects.toThrow('100MB');
});
