import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {verifyReleaseAssets,verifyReleaseTag} from './release-policy.mjs';

const {version} = JSON.parse(await readFile('package.json','utf8'));
assert(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version), 'Invalid release version');
const prerelease = version.includes('-');
const repo = process.env.GITHUB_REPOSITORY,commit = process.env.GITHUB_SHA,tag = `v${version}`;
assert(repo && /^[a-f0-9]{40}$/.test(commit || ''),'Run this script in the release workflow');
const gh = args => execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
let tagRef;
try{tagRef=JSON.parse(gh(['api',`repos/${repo}/git/ref/tags/${tag}`]))}
catch(error){if(!String(error.stderr).includes('HTTP 404'))throw error}
verifyReleaseTag(tagRef,commit);
const expected = ['macOS-arm64.dmg','macOS-arm64.zip','macOS-x64.dmg','macOS-x64.zip','Windows-x64-Setup.exe','Windows-x64.zip'].map(suffix=>`Jimyeon-${version}-${suffix}`);
const files = expected.map(name=>path.join('release-assets',name));
const sums = [];
const digests = new Map();
for (const [index,file] of files.entries()) {
  const bytes = await readFile(file); assert(bytes.length > 1_000_000,`Empty or invalid installer: ${file}`);
  const digest=createHash('sha256').update(bytes).digest('hex');
  digests.set(expected[index],digest);
  sums.push(`${digest}  ${expected[index]}`);
}
const checksum = path.join('release-assets','SHA256SUMS.txt');
await writeFile(checksum,sums.join('\n')+'\n'); files.push(checksum);
digests.set('SHA256SUMS.txt',createHash('sha256').update(await readFile(checksum)).digest('hex'));
let existing;
try { existing = JSON.parse(gh(['release','view',tag,'--repo',repo,'--json','isDraft,targetCommitish,url'])); }
catch (error) { if (!String(error.stderr).includes('release not found')) throw error; }
if (existing) {
  assert(existing.isDraft,'Never overwrite an already published release');
  assert.equal(existing.targetCommitish,commit,'Existing draft was built from a different commit; use a new version');
  gh(['release','upload',tag,'--repo',repo,'--clobber',...files]);
} else {
  gh(['release','create',tag,'--repo',repo,'--target',commit,'--draft',...(prerelease?['--prerelease']:[]),'--title',`지면 · Jimyeon ${tag}`,'--notes-file','RELEASE_NOTES.md',...files]);
}
const {apiUrl}=JSON.parse(gh(['release','view',tag,'--repo',repo,'--json','apiUrl']));
let release = JSON.parse(gh(['api',apiUrl]));
verifyReleaseAssets(release,digests,commit);
if(process.env.PUBLISH_RELEASE==='true'){
 assert(release.draft,'Never publish an already published release');
 gh(['release','edit',tag,'--repo',repo,'--draft=false',...(prerelease?['--prerelease','--latest=false']:['--latest'])]);
 release=JSON.parse(gh(['api',apiUrl]));
 assert.equal(release.draft,false);
 verifyReleaseAssets(release,digests,commit);
}
console.log(release.html_url);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY,`${release.draft?'Draft':'Published'} release: ${release.html_url}\n\nAll six installers/archives and SHA256SUMS.txt uploaded and verified.\n`,{flag:'a'});
