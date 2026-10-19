import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const notices = ['Jimyeon — third-party dependency licenses',
  'Generated from installed runtime dependencies pinned in package-lock.json.',
  'Electron runtime notices are additionally supplied by Electron in the packaged application.'];

for (const [location, entry] of Object.entries(lock.packages || {}).sort(([a], [b]) => a.localeCompare(b))) {
  if (!location || entry.dev || entry.link) continue;
  const directory = path.join(root, location);
  let files;
  try { files = await readdir(directory, {withFileTypes: true}); }
  catch (error) { if (error.code === 'ENOENT' && entry.optional) continue; throw error; }
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  notices.push('\n' + '='.repeat(72), `${pkg.name}@${pkg.version}`, `License: ${pkg.license || entry.license || 'See package source'}`);
  const licenses = files.filter(file => file.isFile() && /^(licen[sc]e|copying|notice|copyright|ofl)([.\s_-]|$)/i.test(file.name)).sort((a, b) => a.name.localeCompare(b.name));
  for (const file of licenses) notices.push(`\n--- ${file.name} ---\n`, await readFile(path.join(directory, file.name), 'utf8'));
  if (!licenses.length) notices.push(`Source and package notices: https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`);
}

await writeFile(path.join(root, 'THIRD_PARTY_LICENSES.txt'), notices.join('\n') + '\n');
console.log('Third-party license notices collected.');
