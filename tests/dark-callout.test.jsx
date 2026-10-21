import {afterEach,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const sheet=name=>{const style=document.createElement('style');style.textContent=readFileSync(new URL('../src/'+name,import.meta.url),'utf8');document.head.append(style);return [...style.sheet.cssRules]};
afterEach(()=>document.head.replaceChildren());
describe('callout background on the paper',()=>{
  // jsdom resolves cascade priority by source order only, so the rule's own !important is checked instead.
  it('pins the light callout background so the dark theme rule cannot override it',()=>{
    const paper=sheet('paper-ui.css').find(rule=>/callout/.test(rule.selectorText||'')&&/\.live-document/.test(rule.selectorText));
    expect(paper,'paper-ui.css에서 .live-document 콜아웃 규칙을 찾지 못했습니다').toBeDefined();
    expect(paper.style.getPropertyValue('background')).toBe('#f7f7f5');
    expect(paper.style.getPropertyPriority('background')).toBe('important');
  });
});
