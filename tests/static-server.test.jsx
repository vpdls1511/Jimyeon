import {spawn} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {existsSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';

const serverFile=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','server.mjs');
const dist=path.join(path.dirname(serverFile),'dist'),indexFile=path.join(dist,'index.html');
let child,port,createdIndex=false,createdDist=false;

function freePort(){return new Promise((resolve,reject)=>{const probe=net.createServer();probe.on('error',reject);probe.listen(0,'127.0.0.1',()=>{const {port}=probe.address();probe.close(()=>resolve(port))})})}
function get(rawPath){return new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path:rawPath},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}))}).on('error',reject)})}

beforeAll(async()=>{
  // /index.html/x only reaches ENOTDIR when dist/index.html is a file, so create it when the build has not run
  if(!existsSync(indexFile)){createdDist=!existsSync(dist);mkdirSync(dist,{recursive:true});writeFileSync(indexFile,'<!doctype html>');createdIndex=true}
  port=await freePort();
  child=spawn(process.execPath,[serverFile],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit']});
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>reject(Error(`server exited: ${code}`)));child.stdout.once('data',resolve)});
},15000);
afterAll(()=>{child?.kill();if(createdIndex)rmSync(createdDist?dist:indexFile,{recursive:true,force:true})});

describe('static server bad paths',()=>{
  it.each(['/%E0%A4%A','/%','/%00','/index.html/x'])('answers %s with a 4xx and no internal error text',async raw=>{
    const {status,body}=await get(raw);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    expect(body).not.toMatch(/URIError|URI malformed|ERR_INVALID_ARG_VALUE|ENOTDIR|null bytes/i);
  });
  it('keeps answering missing files with 404 and traversal with 403',async()=>{
    expect((await get('/nope.js')).status).toBe(404);
    expect((await get('/..%2f..%2fpackage.json')).status).toBe(403);
  });
});
