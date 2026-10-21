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
