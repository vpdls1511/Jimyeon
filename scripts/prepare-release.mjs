import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {shouldBuildRelease} from './release-policy.mjs';

const {version}=JSON.parse(await readFile('package.json','utf8'));
assert(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version),'Invalid release version');
const repo=process.env.GITHUB_REPOSITORY,commit=process.env.GITHUB_SHA;
assert(repo&&/^[a-f0-9]{40}$/.test(commit||''),'Run in the release workflow');
let release;
try{release=JSON.parse(execFileSync('gh',['release','view',`v${version}`,'--repo',repo,'--json','isDraft,targetCommitish'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))}
catch(error){if(!String(error.stderr).includes('release not found'))throw error}
const build=shouldBuildRelease(release,commit);
await writeFile(process.env.GITHUB_OUTPUT,`build=${build}\n`,{flag:'a'});
console.log(build?`Build v${version}`:`v${version} is already published; no release build needed.`);
