import { describe, expect, it } from 'vitest';
import { BlockNoteEditor } from '@blocknote/core';
import { openDB } from 'idb';
import { schema } from '../src/blocks';
import { emptyDocument, migrateDocument } from '../src/document';
import { loadDocument, listRevisions } from '../src/storage';

const oldDocument = () => ({
  format: 'local-notion-editor', version: 1, title: '기존 문서',
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
    const db = await openDB('local-notion-editor', 1);
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
