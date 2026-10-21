const path = require('node:path');
const fs = require('node:fs/promises');
const {createHash} = require('node:crypto');
const {serializeDraft, atomicWrite} = require('./files.cjs');

// Serialize writes, retain only a small digest, and leave identical saves on disk.
function createDraftStore(folder, write = atomicWrite) {
  const current = path.join(folder, 'document.json');
  const previous = path.join(folder, 'document.previous.json');
  let chain = Promise.resolve(), savedHash, primaryValid = false;
  // Drafts that could not be read are renamed aside for manual recovery before autosave replaces
  // them. One that cannot be moved yet (for example while another program locks it) stays listed,
  // and every save retries the move first and fails rather than write over it.
  const unreadable = new Set();
  const digest = text => createHash('sha256').update(text).digest('hex');
  async function read(file) {
    const doc = JSON.parse(await fs.readFile(file, 'utf8'));
    serializeDraft(doc);
    return doc;
  }
  async function setAside() {
    const stamp = Date.now();
    for (const file of unreadable) {
      await fs.rename(file, file.replace(/\.json$/, `.corrupt-${stamp}.json`)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      unreadable.delete(file);
    }
  }
  return {
    async load() {
      try {
        const doc = await read(current);
        savedHash = digest(serializeDraft(doc)); primaryValid = true;
        return doc;
      } catch (error) {
        primaryValid = false;
        if (error.code === 'ENOENT') return null;
        unreadable.add(current);
        try { return await read(previous); }
        catch { unreadable.add(previous); throw Error('자동 저장 문서를 읽지 못했습니다. 저장된 문서 파일을 가져와 주세요.'); }
        finally { await setAside().catch(() => {}); }
      }
    },
    save(doc) {
      const text = serializeDraft(doc), hash = digest(text);
      chain = chain.catch(() => {}).then(async () => {
        if (primaryValid && hash === savedHash) return;
        await setAside();
        if (primaryValid) await fs.copyFile(current, previous);
        await write(current, text);
        savedHash = hash; primaryValid = true;
      });
      return chain;
    }
  };
}

module.exports = {createDraftStore};
