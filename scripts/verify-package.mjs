import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';

const {listPackage,extractFile} = createRequire(import.meta.url)('@electron/asar');
const [platform,arch] = process.argv.slice(2);
assert(['macOS','Windows'].includes(platform), 'Expected macOS or Windows');
assert(['arm64','x64'].includes(arch), 'Expected arm64 or x64');
const bundle = platform === 'macOS' ? `release/mac${arch === 'arm64' ? '-arm64' : ''}/Jimyeon.app/Contents` : 'release/win-unpacked';
const archive = path.join(bundle,platform === 'macOS' ? 'Resources' : 'resources','app.asar');
const files = listPackage(archive).map(file => file.replaceAll('\\','/'));
for (const file of ['/dist/index.html','/electron/main.cjs','/electron/preload.cjs','/LICENSE','/THIRD_PARTY_NOTICES.md','/THIRD_PARTY_LICENSES.txt']) assert(files.includes(file), `Missing ${file}`);
assert(!files.some(file => /^\/(?:tests|tmp|examples|node_modules|docs|\.git)(?:\/|$)/.test(file)), 'Unexpected private or development files in package');
const source = JSON.parse(await readFile('package.json','utf8'));
const packaged = JSON.parse(extractFile(archive,'package.json').toString('utf8'));
assert.equal(packaged.name,source.name); assert.equal(packaged.version,source.version);
assert(extractFile(archive,'THIRD_PARTY_LICENSES.txt').length > 1000, 'Dependency notices are empty');
const executable = path.join(bundle,platform === 'macOS' ? 'MacOS/Jimyeon' : 'Jimyeon.exe');
if (platform === 'macOS') {
  execFileSync('codesign',['--verify','--deep','--strict',path.dirname(bundle)]);
  assert.equal(execFileSync('lipo',['-archs',executable],{encoding:'utf8'}).trim(),arch === 'x64' ? 'x86_64' : 'arm64');
  assert.deepEqual(await readFile(path.join(bundle,'Resources/icon.icns')),await readFile('electron/resources/icon.icns'),'Packaged macOS icon differs from the supplied logo');
} else {
  const bytes = await readFile(executable),offset = bytes.readUInt32LE(0x3c);
  assert.equal(bytes.subarray(0,2).toString(),'MZ');
  assert.equal(bytes.subarray(offset,offset+4).toString(),'PE\0\0');
  assert.equal(bytes.readUInt16LE(offset+4),0x8664,'Expected Windows x64 executable');
  const {NtExecutable,NtExecutableResource,Data,Resource} = createRequire(import.meta.url)('resedit');
  const resources = NtExecutableResource.from(NtExecutable.from(bytes));
  const icons = Resource.IconGroupEntry.fromEntries(resources.entries).flatMap(group=>group.getIconItemsFromEntries(resources.entries));
  const sourceIcons = Data.IconFile.from(await readFile('electron/resources/icon.ico')).icons;
  const expected = sourceIcons.find(icon=>icon.data.width===256).data.bin;
  assert(icons.some(icon=>icon.bin && Buffer.from(icon.bin).equals(Buffer.from(expected))),'Windows executable is missing the supplied logo');
}
console.log(`${platform} ${arch}: packaged executable, version, app icon and license notices verified.`);
