import {afterEach,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const sheet=name=>{const style=document.createElement('style');style.textContent=readFileSync(new URL('../src/'+name,import.meta.url),'utf8');document.head.append(style);return [...style.sheet.cssRules]};
afterEach(()=>document.head.replaceChildren());
describe('callout background on the paper',()=>{
  // jsdom resolves cascade priority by source order only, so the rule's own !important is checked instead.
  it('pins the light callout background so the dark theme rule cannot override it',()=>{
    const dark=sheet('style.css').find(rule=>/data-theme="dark"\]\s+\.bn-editor\s+\.bn-block-content\[data-content-type="callout"\]/.test(rule.selectorText||''));
    expect(dark.style.getPropertyValue('background')).toBe('#252525');
    const paper=sheet('paper-ui.css').find(rule=>rule.selectorText==='.live-document .bn-editor [data-content-type=callout]');
    expect(paper.style.getPropertyValue('background')).toBe('#f7f7f5');
    expect(paper.style.getPropertyPriority('background')).toBe('important');
  });
});
