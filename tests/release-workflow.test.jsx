import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';

const state=vi.hoisted(()=>({files:new Map(),calls:[],draft:true,badDigest:false}));
const commit='a'.repeat(40),apiUrl='https://api.github.com/repos/owner/repo/releases/123';
vi.mock('node:fs/promises',()=>{const mock={
 readFile:vi.fn(async file=>{const key=String(file).replaceAll('\\','/');if(!state.files.has(key))throw Error('Missing fixture: '+file);return state.files.get(key)}),
 writeFile:vi.fn(async(file,bytes)=>state.files.set(String(file).replaceAll('\\','/'),bytes)),
};return {...mock,default:mock}});
vi.mock('node:child_process',()=>{const mock={execFileSync:vi.fn((command,args)=>{
 state.calls.push(args);
 if(args[0]==='release'&&args[1]==='view'){
  if(args.at(-1)==='apiUrl')return JSON.stringify({apiUrl});
  const error=Error('Not found');error.stderr='release not found';throw error;
 }
 if(args[0]==='api'){
  if(args[1].includes('/git/ref/tags/')){const error=Error('Not found');error.stderr='HTTP 404';throw error}
  if(args[1]!==apiUrl)throw Error('Drafts must be fetched through their API ID, not a pending tag');
  const assets=[...state.files.entries()].filter(([file])=>file.startsWith('release-assets/')).map(([file,bytes])=>({name:file.slice('release-assets/'.length),state:'uploaded',digest:'sha256:'+createHash('sha256').update(bytes).digest('hex')}));
  if(state.badDigest)assets[0].digest='sha256:wrong';
  return JSON.stringify({target_commitish:'a'.repeat(40),assets,draft:state.draft,html_url:'https://github.com/owner/repo/releases/tag/v1.0.1'});
 }
 if(args[0]==='release'&&args[1]==='edit')state.draft=false;
 return '';
})};return {...mock,default:mock}});

beforeEach(()=>{
 vi.resetModules();state.files.clear();state.calls=[];state.draft=true;state.badDigest=false;
 state.files.set('package.json',JSON.stringify({version:'1.0.1'}));
 for(const suffix of ['macOS-arm64.dmg','macOS-arm64.zip','macOS-x64.dmg','macOS-x64.zip','Windows-x64-Setup.exe','Windows-x64.zip'])state.files.set('release-assets/Jimyeon-1.0.1-'+suffix,Buffer.alloc(1_000_001,suffix.length));
 vi.stubEnv('GITHUB_REPOSITORY','owner/repo');vi.stubEnv('GITHUB_SHA',commit);vi.stubEnv('GITHUB_REF_TYPE','branch');vi.stubEnv('GITHUB_STEP_SUMMARY','');vi.stubEnv('PUBLISH_RELEASE','false');
});
afterEach(()=>vi.unstubAllEnvs());

it('fetches an unpublished draft by API ID and leaves manual runs as drafts',async()=>{
 await import('../scripts/create-release.mjs');
 expect(state.calls.some(args=>args[0]==='api'&&args[1]===apiUrl)).toBe(true);
 expect(state.calls.some(args=>args[1]==='edit')).toBe(false);expect(state.draft).toBe(true);
});
it('publishes automatic runs only after uploads and all seven digests are verified',async()=>{
 vi.stubEnv('PUBLISH_RELEASE','true');await import('../scripts/create-release.mjs');
 const verify=state.calls.findIndex(args=>args[0]==='api'&&args[1]===apiUrl),publish=state.calls.findIndex(args=>args[1]==='edit');
 expect(verify).toBeGreaterThan(-1);expect(publish).toBeGreaterThan(verify);expect(state.draft).toBe(false);
});
it('does not publish when any uploaded digest differs from the local file',async()=>{
 vi.stubEnv('PUBLISH_RELEASE','true');state.badDigest=true;
 await expect(import('../scripts/create-release.mjs')).rejects.toThrow('checksum mismatch');
 expect(state.calls.some(args=>args[1]==='edit')).toBe(false);expect(state.draft).toBe(true);
});
