const path = require('node:path');
const fs = require('node:fs/promises');
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

function bundlePath(root, address) {
  const url = new URL(address);
  if (url.protocol !== 'app:' || url.host !== 'editor' || url.username || url.password) return null;
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  return file.startsWith(path.resolve(root) + path.sep) ? file : null;
}

function validatePDF(job) {
  if (!job || !['A4', 'A3'].includes(job.paper) || typeof job.html !== 'string' || !Number.isInteger(job.pageCount) ||
      job.pageCount < 1 || job.pageCount > 300) throw Error('올바른 용지와 페이지 구성이 필요합니다.');
  if (Buffer.byteLength(job.html) > MAX_DOCUMENT_BYTES) throw Error('문서가 너무 커서 PDF로 저장할 수 없습니다(최대 100MB). 이미지 크기를 줄이거나 문서를 나누어 주세요.');
  return job;
}

function serializeDraft(doc) {
  if (!doc || doc.format !== 'local-notion-editor' || doc.version !== 2 || !Array.isArray(doc.blocks)) {
    throw Error('올바른 편집 문서가 아닙니다.');
  }
  const text = JSON.stringify(doc);
  if (Buffer.byteLength(text) > MAX_DOCUMENT_BYTES) throw Error('문서 크기가 너무 큽니다.');
  return text;
}

function safeName(name, fallback = '문서') {
  return String(name || fallback).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 160) || fallback;
}

function saveFileOptions(file) {
  if (!file || !(file.bytes instanceof Uint8Array) || file.bytes.byteLength > MAX_DOCUMENT_BYTES || !['application/json', 'text/markdown'].includes(file.type)) throw Error('저장할 문서를 확인해 주세요.');
  const extension = file.type === 'text/markdown' ? 'md' : /\.json$/i.test(file.name) ? 'json' : 'jimyeon';
  const name = safeName(file.name);
  return {defaultPath: name.toLowerCase().endsWith('.' + extension) ? name : name + '.' + extension,
    filters: [{name: extension === 'md' ? '마크다운' : extension === 'json' ? '지면 JSON 문서' : '지면 문서', extensions: [extension]}]};
}

function externalURL(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

async function atomicWrite(file, bytes) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  const temp = `${file}.${process.pid}.${require('node:crypto').randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temp, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temp, file);
  } finally { await fs.rm(temp, {force: true}); }
}

async function resolveImage(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('이미지 주소를 확인해 주세요.');
  const response = await fetch(url, {signal: AbortSignal.timeout(12000)});
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.startsWith('image/')) throw Error('이미지를 불러오지 못했습니다.');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 20 * 1024 * 1024) throw Error('이미지 파일 크기가 너무 큽니다.');
    chunks.push(chunk);
  }
  return {bytes: Buffer.concat(chunks), type};
}

module.exports = {bundlePath, validatePDF, serializeDraft, safeName, saveFileOptions, externalURL, atomicWrite, resolveImage, MAX_DOCUMENT_BYTES};
