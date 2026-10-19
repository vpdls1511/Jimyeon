import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const {version} = JSON.parse(await readFile('package.json','utf8'));
assert(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version), 'Invalid release version');
const repo = process.env.GITHUB_REPOSITORY,commit = process.env.GITHUB_SHA,tag = `v${version}`;
assert(repo && /^[a-f0-9]{40}$/.test(commit || ''),'Run this script in the release workflow');
if (process.env.GITHUB_REF_TYPE === 'tag') assert.equal(process.env.GITHUB_REF_NAME,tag,'Tag and package versions must match');
const gh = args => execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const expected = ['macOS-arm64.dmg','macOS-arm64.zip','macOS-x64.dmg','macOS-x64.zip','Windows-x64-Setup.exe','Windows-x64.zip'].map(suffix=>`Jimyeon-${version}-${suffix}`);
const files = expected.map(name=>path.join('release-assets',name));
const sums = [];
for (const [index,file] of files.entries()) {
  const bytes = await readFile(file); assert(bytes.length > 1_000_000,`Empty or invalid installer: ${file}`);
  sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${expected[index]}`);
}
const checksum = path.join('release-assets','SHA256SUMS.txt');
await writeFile(checksum,sums.join('\n')+'\n'); files.push(checksum);
let existing;
try { existing = JSON.parse(gh(['release','view',tag,'--repo',repo,'--json','isDraft,targetCommitish,url'])); }
catch (error) { if (!String(error.stderr).includes('release not found')) throw error; }
if (existing) {
  assert(existing.isDraft,'Never overwrite an already published release');
  assert.equal(existing.targetCommitish,commit,'Existing draft was built from a different commit; use a new version');
  gh(['release','upload',tag,'--repo',repo,'--clobber',...files]);
} else {
  gh(['release','create',tag,'--repo',repo,'--target',commit,'--draft','--title',`지면 · Jimyeon ${tag}`,'--notes-file','RELEASE_NOTES.md',...files]);
}
const release = JSON.parse(gh(['release','view',tag,'--repo',repo,'--json','url,isDraft,assets,targetCommitish']));
assert.equal(release.targetCommitish,commit);
for (const file of [...expected,'SHA256SUMS.txt']) assert(release.assets.some(asset=>asset.name===file),`Release asset missing: ${file}`);
console.log(release.url);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY,`Draft release: ${release.url}\n\nAll six installers/archives and SHA256SUMS.txt uploaded.\n`,{flag:'a'});
