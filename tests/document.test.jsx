import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockNoteEditor } from '@blocknote/core';
import { openDB } from 'idb';
import { IDBFactory } from 'fake-indexeddb';
import { schema } from '../src/blocks';
import { emptyDocument, migrateDocument, LEGACY_ID } from '../src/document';
import { loadDocument, listRevisions } from '../src/storage';

const oldDocument = () => ({
  format: LEGACY_ID, version: 1, title: '기존 문서',
  threads: [{ id: 'comment-1', comments: [{ body: '삭제 대상 댓글' }] }],
  proseMirrorJSON: { type: 'doc', content: [] },
  blocks: [
    { id: 'copy', type: 'syncedReference', props: { sourceId: 'source', snapshot: '[]' } },
    { id: 'source', type: 'syncedBlock', children: [
      { id: 'text', type: 'bulletListItem', content: '보존할 본문', children: [
        { id: 'nested', type: 'bulletListItem', content: '하위 항목' },
      ] },
    ] },
  ],
});

describe('migration after removing comments and synchronization', () => {
  it('preserves the source and its copies as independent editable blocks', () => {
    const previous = oldDocument();
    const next = migrateDocument(previous);
    expect(next).not.toHaveProperty('threads');
    expect(next).not.toHaveProperty('proseMirrorJSON');
    expect(next.blocks.map(b => b.type)).toEqual(['bulletListItem', 'bulletListItem']);
    const editor = BlockNoteEditor.create({ schema, initialContent: next.blocks });
    try {
      const [copy, original] = editor.document;
      expect(copy.id).not.toBe(original.id);
      expect(copy.children[0].id).not.toBe(original.children[0].id);
      expect(original.id).toBe('text');
      editor.updateBlock(copy, { content: '독립된 수정' });
      expect(editor.getBlock(original.id).content[0].text).toBe('보존할 본문');
      expect(original.children[0].content[0].text).toBe('하위 항목');
    } finally { editor._tiptapEditor.destroy(); }
    expect(previous).toEqual(oldDocument());
  });

  it('recovers an orphan copy from its snapshot, including inside a column', () => {
    const doc = migrateDocument({ blocks: [{ type: 'columnList', children: [
      { type: 'column', children: [{ type: 'syncedReference', props: {
        sourceId: 'missing', snapshot: JSON.stringify([{ type: 'paragraph', content: '남은 내용' }]),
      } }] },
      { type: 'column', children: [{ type: 'paragraph', content: '오른쪽' }] },
    ] }] });
    expect(doc.blocks[0].children[0].children[0]).toMatchObject({ type: 'paragraph', content: '남은 내용' });
  });

  it('handles missing or recursive legacy sources without crashing', () => {
    expect(migrateDocument({ blocks: [{ type: 'syncedReference', props: { snapshot: 'invalid' } }] }).blocks[0].type).toBe('paragraph');
    const doc = migrateDocument({ blocks: [{ id: 'source', type: 'syncedBlock', children: [
      { type: 'paragraph', content: '보존' },
      { type: 'syncedReference', props: { sourceId: 'source' } },
    ] }] });
    expect(doc.blocks[0].content).toBe('보존');
    expect(doc.blocks).toHaveLength(2);
  });

  it('keeps external embeds, bookmarks and URL media unchanged', () => {
    const blocks = [
      { type: 'embed', props: { url: 'https://example.com/embed' } },
      { type: 'bookmark', props: { url: 'https://example.com', title: '외부 링크' } },
      { type: 'image', props: { url: 'https://example.com/photo.png', previewWidth: 250 } },
      { type: 'video', props: { url: 'https://example.com/video.mp4' } },
      { type: 'audio', props: { url: 'https://example.com/audio.mp3' } },
      { type: 'file', props: { url: 'https://example.com/file.pdf' } },
    ];
    expect(migrateDocument({ blocks }).blocks).toEqual(blocks);
    expect(schema.blockSchema).not.toHaveProperty('syncedBlock');
    expect(schema.blockSchema).not.toHaveProperty('syncedReference');
  });

  it('cleans the existing saved document and its revision records on startup', async () => {
    const db = await openDB('jimyeon', 1);
    const previous = oldDocument();
    await db.put('documents', previous, 'current');
    await db.put('revisions', { time: 1, doc: previous });
    const doc = await loadDocument();
    expect(await db.get('documents', 'current')).toEqual(doc);
    expect(doc.version).toBe(2);
    const stored = (await db.get('revisions', 1)).doc;
    expect(stored).not.toHaveProperty('threads');
    expect(stored).not.toHaveProperty('proseMirrorJSON');
    expect(stored.blocks[0].type).toBe('bulletListItem');
    expect((await listRevisions()).find(v => v.time === 1).doc).toEqual(stored);
    db.close();
  });

  it('defaults the paper to A4 and keeps a saved A3 paper', () => {
    expect(emptyDocument().paper).toBe('A4');
    expect(migrateDocument({}).paper).toBe('A4');
    expect(migrateDocument({ paper: 'A3' }).paper).toBe('A3');
  });
});

describe('browser storage renamed from the previous identifier', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  // A fresh browser profile whose only data is in the database of the previous name.
  async function legacyProfile() {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const legacy = await openDB(LEGACY_ID, 1, { upgrade(db) { db.createObjectStore('documents'); db.createObjectStore('revisions', { keyPath: 'time' }); } });
    await legacy.put('documents', { ...emptyDocument(), format: LEGACY_ID, title: '옮길 문서' }, 'current');
    await legacy.put('revisions', { time: 1, doc: { ...emptyDocument(), format: LEGACY_ID, title: '이전 기록' } });
    legacy.close();
  }
  const start = async () => { vi.resetModules(); return import('../src/storage'); };
  const contents = async name => {
    const db = await openDB(name);
    try { return db.objectStoreNames.contains('documents') ? { current: (await db.get('documents', 'current'))?.title, revisions: (await db.getAll('revisions')).map(v => v.doc.title) } : null; }
    finally { db.close(); }
  };

  it('copies the autosaved document and revisions into the new database and keeps the old one', async () => {
    await legacyProfile();
    const storage = await start();
    expect((await storage.loadDocument()).title).toBe('옮길 문서');
    expect((await storage.listRevisions()).map(v => v.doc.title)).toEqual(['이전 기록']);
    expect(await contents('jimyeon')).toEqual({ current: '옮길 문서', revisions: ['이전 기록'] });
    expect(await contents(LEGACY_ID)).toEqual({ current: '옮길 문서', revisions: ['이전 기록'] });
  });

  it('does not touch the old database when the new one already has data', async () => {
    await legacyProfile();
    const db = await openDB('jimyeon', 1, { upgrade(d) { d.createObjectStore('documents'); d.createObjectStore('revisions', { keyPath: 'time' }); } });
    await db.put('documents', { ...emptyDocument(), title: '새 문서' }, 'current');
    db.close();
    const storage = await start();
    expect((await storage.loadDocument()).title).toBe('새 문서');
    expect(await contents('jimyeon')).toEqual({ current: '새 문서', revisions: [] });
    expect(await contents(LEGACY_ID)).toEqual({ current: '옮길 문서', revisions: ['이전 기록'] });
  });

  it('gives the same result when started again, and ignores later changes to the old database', async () => {
    await legacyProfile();
    let storage = await start();
    await storage.loadDocument();
    await storage.saveDocument({ ...emptyDocument(), title: '이어서 고친 문서' });
    const legacy = await openDB(LEGACY_ID);
    await legacy.put('documents', { ...emptyDocument(), format: LEGACY_ID, title: '옛 탭에서 고친 문서' }, 'current');
    await legacy.put('revisions', { time: 2, doc: { ...emptyDocument(), title: '옛 탭 기록' } });
    legacy.close();
    for (let i = 0; i < 2; i++) {
      storage = await start();
      expect((await storage.loadDocument()).title).toBe('이어서 고친 문서');
      expect((await storage.listRevisions()).map(v => v.doc.title)).toEqual(['이전 기록']);
    }
  });

  it('starts without waiting for an old tab that still has the old database open', async () => {
    await legacyProfile();
    const oldTab = await openDB(LEGACY_ID);
    const storage = await start();
    expect((await storage.loadDocument()).title).toBe('옮길 문서');
    oldTab.close();
    expect(await contents(LEGACY_ID)).toEqual({ current: '옮길 문서', revisions: ['이전 기록'] });
    // Closing the old tab later leaves nothing to redo: the next start does not read the old database again.
    const reopen = vi.spyOn(indexedDB, 'open');
    await (await start()).loadDocument();
    expect(reopen.mock.calls.map(([name]) => name)).not.toContain(LEGACY_ID);
  });

  it('keeps a document another tab saved while this tab was starting', async () => {
    await legacyProfile();
    const tabA = await start(), tabB = await start();
    const [docA] = await Promise.all([tabA.loadDocument(), tabB.loadDocument().catch(() => null)]);
    expect(docA.title).toBe('옮길 문서');
    await tabA.saveDocument({ ...emptyDocument(), title: 'A 탭에서 고친 문서' });
    const tabC = await start();
    expect((await tabC.loadDocument()).title).toBe('A 탭에서 고친 문서');
    expect(await contents('jimyeon')).toEqual({ current: 'A 탭에서 고친 문서', revisions: ['이전 기록'] });
  });

  it('keeps the old database when the move fails, and moves it on the next start', async () => {
    await legacyProfile();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('저장 공간 부족', 'QuotaExceededError'); });
    let storage = await start();
    await expect(storage.loadDocument()).rejects.toThrow('저장 공간 부족');
    put.mockRestore();
    expect(await contents(LEGACY_ID)).toEqual({ current: '옮길 문서', revisions: ['이전 기록'] });
    expect(await contents('jimyeon')).toEqual({ current: undefined, revisions: [] });
    storage = await start();
    expect((await storage.loadDocument()).title).toBe('옮길 문서');
    expect(await contents('jimyeon')).toEqual({ current: '옮길 문서', revisions: ['이전 기록'] });
  });
});
