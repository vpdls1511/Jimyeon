export const PAPER = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
};
export const PX_PER_MM = 96 / 25.4;
export const paperSize = name => PAPER[name] || PAPER.A4;

export function collectStyles(doc = document, {activeMediaOnly = false} = {}) {
  const serialize = rules => [...rules].map(rule => {
    // Electron prints in print media. Preserve the live screen's media choices
    // so responsive and print-only rules cannot change an already frozen page.
    if (activeMediaOnly && rule.type === 4) return doc.defaultView.matchMedia(rule.conditionText).matches ? serialize(rule.cssRules) : '';
    if (activeMediaOnly && rule.cssRules && rule.type !== 1) return `${rule.cssText.slice(0, rule.cssText.indexOf('{'))}{${serialize(rule.cssRules)}}`;
    return rule.cssText;
  }).join('\n');
  return [...doc.styleSheets].map(sheet => {
    try {
      const base = sheet.href || doc.baseURI;
      return serialize(sheet.cssRules)
        .replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (all, quote, url) => {
          if (/^(data:|blob:|#)/.test(url)) return all;
          return `url("${new URL(url, base).href}")`;
        });
    } catch { return ''; }
  }).join('\n');
}

// Take a presentation-only snapshot. The live ProseMirror DOM is never moved,
// split or modified by pagination, so caret, history and drag behavior survive.
export function capturePaperSource(source, meta) {
  const copy = source.cloneNode(true);
  const originalNodes = [source, ...source.querySelectorAll('*')];
  const copyNodes = [copy, ...copy.querySelectorAll('*')];
  originalNodes.forEach((node, i) => {
    const clone = copyNodes[i];
    if (node !== source && getComputedStyle(node).display === 'none') clone.remove();
    if (node instanceof HTMLInputElement && node.type === 'checkbox') {
      if (node.checked) clone.setAttribute('checked', '');
      else clone.removeAttribute('checked');
    }
    if(node instanceof HTMLSelectElement)clone.dataset.printSelectedText=node.selectedOptions[0]?.textContent||'';
    clone.removeAttribute('contenteditable');
    clone.removeAttribute('tabindex');
    clone.removeAttribute('aria-activedescendant');
    clone.removeAttribute('data-show-selection');
    clone.removeAttribute('data-drop-target');
    clone.removeAttribute('data-block-range-selected');
    clone.classList.remove('ProseMirror-selectednode','ProseMirror-focused','selectedCell');
    for (const theme of ['data-color-scheme','data-mantine-color-scheme']) if(clone.hasAttribute(theme))clone.setAttribute(theme,'light');
    if (clone.tagName === 'IMG') { clone.loading = 'eager'; clone.decoding = 'sync'; }
  });
  copy.querySelectorAll('.page-tools,.page-emoji,.cover-actions,.locked-note,.bn-side-menu,.bn-toolbar,.bn-suggestion-menu,.bn-file-block-top,.web-edit,.button-config,.button-settings,.emoji-popover,.tabs-bar button[title="탭 추가"],script').forEach(n => n.remove());
  const title = copy.querySelector('#document-title');
  if (title) {
    const heading = document.createElement('div');
    heading.id = 'document-title';
    heading.textContent = meta.title;
    title.replaceWith(heading);
  }
  copy.querySelectorAll('select').forEach(select => {
    const label = document.createElement('div');
    label.className = 'print-language';
    label.textContent = select.dataset.printSelectedText || '';
    select.replaceWith(label);
  });
  copy.querySelectorAll('iframe,video,audio').forEach(media => {
    const card = document.createElement('a');
    card.className = 'print-media-card';
    card.href = media.getAttribute('src') || media.querySelector('source')?.src || '';
    card.textContent = `${media.tagName === 'IFRAME' ? '외부 임베드' : media.tagName === 'VIDEO' ? '영상' : '오디오'} · ${card.href}`;
    media.replaceWith(card);
  });
  copy.querySelectorAll('.equation form').forEach(form => {
    const preview = form.querySelector('.equation-preview');
    if (preview) form.replaceWith(preview);
  });
  copy.querySelectorAll('[data-content-type="pageBreak"]').forEach(marker => {
    const outer = marker.closest('.bn-block-outer') || marker;
    outer.replaceChildren();
    outer.className = 'manual-page-break';
  });
  copy.removeAttribute('id');
  copy.className = `print-document app font-${meta.font}${meta.small ? ' small-text' : ''}`;
  return copy.outerHTML;
}

export function paperCSS(name) {
  const size = paperSize(name);
  return `
    @page { size: ${size.width}mm ${size.height}mm; margin: 16mm; }
    :root { color-scheme: light; --background:#fff; --text:#37352f; --muted:#9b9a97; --hover:#efefed; --border:#e9e9e7; }
    html,body { margin:0!important; padding:0!important; color:#37352f; background:white; }
    .print-document { width:100%; color:#37352f; background:white; }
    .print-document .document,.print-document .full-width .document { width:100%; max-width:none!important; padding:0!important; margin:0!important; }
    .print-document .document-prelude { padding-top:0; }
    .print-document #document-title { font-size:40px!important; line-height:1.2; height:auto; min-height:0; white-space:pre-wrap; overflow-wrap:anywhere; }
    .print-document #document-title:empty { display:none; }
    .print-document .bn-editor { padding:0!important; min-height:0!important; background:transparent; color:#37352f; --bn-colors-editor-text:#37352f; --bn-colors-editor-background:#fff; }
    .print-document [data-content-type="codeBlock"] { color:#37352f; }
    .print-document .shiki { color:var(--shiki-light)!important; }
    .print-document .bn-container { font-size:16px; line-height:1.5; }
    .print-document.small-text .bn-container { font-size:14px; }
    .print-document h1 { font-size:30px!important; }
    .print-document h2 { font-size:24px!important; }
    .print-document .cover { height:60mm; margin-bottom:8mm; }
    .print-document .page-icon { font-size:72px; margin:0 0 22px; padding:4px 4px 0; }
    .print-document .bn-block-outer { break-inside:auto; }
    .print-document .bn-block { display:block!important; }
    .print-document .print-column-fragment { break-inside:avoid; }
    .print-document .print-column-fragment + .print-column-fragment { break-before:page; }
    .print-document .print-table-fragment { break-inside:avoid; }
    .print-document .print-table-fragment + .print-table-fragment { break-before:page; }
    .print-document .print-long-table-first { break-before:page; }
    .print-document .oversized-table-row { break-inside:auto; }
    .print-document .bn-block-content { display:block!important; position:relative; overflow-wrap:anywhere; }
    .print-document .bn-block-content::before { display:none; }
    .print-document .bn-block-content[data-content-type="bulletListItem"],.print-document .bn-block-content[data-content-type="numberedListItem"],.print-document .bn-block-content[data-content-type="checkListItem"] { padding-left:26px; }
    .print-document .bn-block-content[data-content-type="bulletListItem"]::before,.print-document .bn-block-content[data-content-type="numberedListItem"]::before { display:block; position:absolute; left:0; top:3px; height:auto; width:24px; text-align:center; }
    .print-document .bn-block-content[data-content-type="checkListItem"]>div:has(>input) { position:absolute; left:0; top:3px; }
    .print-document .bn-block-content[data-content-type="heading"] { break-after:avoid; }
    .print-document .bn-block-content[data-content-type="image"],.print-document .bn-block-content[data-content-type="callout"],.print-document figure { break-inside:avoid; }
    .print-document img { max-width:100%; max-height:${size.height - 45}mm; object-fit:contain; }
    .print-document p { orphans:2; widows:2; }
    .print-document table { break-inside:auto; }
    .print-document .tableWrapper { overflow:visible!important; padding:0!important; }
    .print-document tr { break-inside:avoid; }
    .print-document thead { display:table-header-group; }
    .print-document .find-match { background:transparent!important; }
    .print-document .bn-is-empty::before,.print-document [data-placeholder]::before { content:none!important; }
    .print-document .manual-page-break { break-before:page; height:0; margin:0; padding:0; }
    .print-document .print-language { font-size:10px; color:#777; margin-bottom:8px; }
    .print-document .print-media-card { display:block; border:1px solid #ddd; padding:14px; color:#555; font-size:12px; overflow-wrap:anywhere; }
    .print-document .tabs-bar { break-after:avoid; }
    .print-document [data-print-continued]::before { visibility:hidden; }
    .print-document button { cursor:default; }
    .print-document input[type=checkbox] { accent-color:#37352f; }
    * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
  `;
}

export function frozenPageHTML(doc, paper) {
  const pages = [...doc.querySelectorAll('.pagedjs_page')];
  if (!pages.length) throw new Error('페이지 미리보기를 먼저 완성해 주세요.');
  const freeze = page => {
    const clone = page.cloneNode(true);
    const originals = [page, ...page.querySelectorAll('*')];
    const clones = [clone, ...clone.querySelectorAll('*')];
    originals.forEach((node, i) => {
      const styles = doc.defaultView.getComputedStyle(node);
      clones[i].style.cssText = [...styles].map(k => `${k}:${styles.getPropertyValue(k)}`).join(';');
      clones[i].removeAttribute('contenteditable');
    });
    clone.style.setProperty('margin', '0', 'important');
    clone.style.setProperty('box-shadow', 'none', 'important');
    clone.style.setProperty('border', '0', 'important');
    clone.style.setProperty('break-after', 'page', 'important');
    return clone.outerHTML;
  };
  const size = paperSize(paper);
  const styleText = [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n');
  return {
    paper, pageCount: pages.length,
    html: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="${location.origin}/"><style>${styleText}</style><style>
      @page{size:${size.width}mm ${size.height}mm;margin:0}
      html,body{margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important;width:${size.width}mm!important}
      .pagedjs_page{width:${size.width}mm!important;height:${size.height}mm!important;overflow:hidden!important;position:relative!important;transform:none!important}
      .pagedjs_page:last-child{break-after:auto!important}
      .pagedjs_page::before,.pagedjs_page::after{display:none!important}
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;animation:none!important;transition:none!important}
    </style></head><body>${pages.map(freeze).join('')}</body></html>`,
  };
}
