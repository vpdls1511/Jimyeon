import {pageSettings} from './page-settings';
import {dividerOpacity} from './divider-opacity';

export const DOCUMENT_EXTENSION = '.jimyeon';
// Keep legacy backups readable while all new exports use the Jimyeon extension.
export const isDocumentFile = name => /\.(?:jimyeon|json)$/i.test(name);
export function parseDocumentFile(text) {
  let input;
  try { input = JSON.parse(text); }
  catch { throw Error('문서 파일이 손상되었거나 형식이 올바르지 않습니다.'); }
  if (!input || input.format !== 'local-notion-editor' || !Array.isArray(input.blocks)) {
    throw Error('이 에디터에서 저장한 문서를 선택하세요.');
  }
  return migrateDocument(input);
}

export const emptyDocument = () => ({
  format: 'local-notion-editor', version: 2,
  title: '', icon: '', cover: '', coverPosition: 50,
  wide: false, small: false, font: 'default', theme: 'light',
  locked: false, paper: 'A4',fontSize:12,titleFontSize:30,lineHeight:1.5,letterSpacing:0,blockGap:0,linkColor:'#2365a8',marginTop:16,marginBottom:16,marginLeft:16,marginRight:16,pageNumber:'none',blocks: [{ type: 'paragraph', content: [] }],
});

// Old synchronized copies become independent blocks. Resolve from the complete
// source tree first so copies also work when they occur before their source.
export function migrateDocument(value) {
  const original = structuredClone(value || {});
  const sources = new Map();
  const visit = blocks => {
    for (const block of blocks || []) {
      if (block.type === 'syncedBlock' && block.id) sources.set(block.id, block);
      visit(block.children);
    }
  };
  visit(original.blocks);

  const usedIds = new Set();
  const blank = () => ({ type: 'paragraph', content: [] });
  const expand = (blocks, freshIds = false, path = new Set()) => {
    return (blocks || []).flatMap(block => {
      if (block.type === 'syncedBlock') {
        if (path.has(block.id)) return [blank()];
        const nextPath = new Set(path).add(block.id);
        const contents = expand(block.children, freshIds, nextPath);
        return contents.length ? contents : [blank()];
      }
      if (block.type === 'syncedReference') {
        const sourceId = block.props?.sourceId;
        if (path.has(sourceId)) return [blank()];
        let contents = sources.get(sourceId)?.children;
        if (!contents) {
          try { contents = JSON.parse(block.props?.snapshot || '[]'); }
          catch { contents = []; }
        }
        const nextPath = new Set(path).add(sourceId);
        const expanded = expand(Array.isArray(contents) ? contents : [], true, nextPath);
        return expanded.length ? expanded : [blank()];
      }
      const copy = { ...block };
      if(copy.props){copy.props={...copy.props};for(const property of ['spaceBefore','spaceAfter'])if(property in copy.props){const value=Number(copy.props[property]);copy.props[property]=Number.isFinite(value)?Math.max(-1,Math.min(96,value)):-1}}
      if(copy.type==='divider'&&copy.props&&'opacity' in copy.props)copy.props.opacity=dividerOpacity(copy.props.opacity);
      if (freshIds || (copy.id && usedIds.has(copy.id))) delete copy.id;
      if (copy.id) usedIds.add(copy.id);
      if (copy.children) copy.children = expand(copy.children, freshIds, path);
      return [copy];
    });
  };

  const document = emptyDocument();
  // Only document properties are carried forward: removed comment annotations,
  // thread records and raw editor state must never reappear on import/restore.
  // Values of the wrong type (e.g. an object title from another tool) fall back to the default.
  for (const key of Object.keys(document)) {
    if (!['format', 'version', 'blocks'].includes(key) && typeof original[key] === typeof document[key]) {
      document[key] = original[key];
    }
  }
  const blocks = expand(Array.isArray(original.blocks) ? original.blocks : []);
  document.blocks = blocks.length ? blocks : [blank()];
  Object.assign(document,pageSettings({...document,...original,fontSize:original.fontSize??(original.small?10.5:12),titleFontSize:original.titleFontSize}),{small:false});
  return document;
}
