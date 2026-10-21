import {afterEach,describe,expect,it} from 'vitest';
import {collectStyles} from '../src/paper';
import {freezeLiveSource} from '../src/live-print';

afterEach(()=>document.body.replaceChildren());
describe('paper source shared by live preview and PDF',()=>{
  it('freezes active screen media instead of activating print or narrow-page rules',()=>{
    const style=document.createElement('style');style.textContent='@media screen {.screen{color:green}} @media print {.table{break-inside:avoid}} @media (max-width:800px) {.title{font-size:27px!important}} @font-face{font-family:test;src:url(./font.woff2)}';document.body.append(style);
    const doc={styleSheets:[style.sheet],baseURI:'app://editor/',defaultView:{matchMedia:query=>({matches:query==='screen'})}};
    const css=collectStyles(doc,{activeMediaOnly:true});
    expect(css).toContain('.screen');expect(css).not.toContain('@media');expect(css).not.toContain('.table');expect(css).not.toContain('.title');expect(css).toContain('app://editor/font.woff2');
    expect(collectStyles(doc)).toContain('@media print');
  });
  it('retains content and columns, strips editing controls, and leaves the live editor untouched',async()=>{
    const source=document.createElement('div');
    source.innerHTML='<main class="document"><textarea id="document-title"></textarea><div class="page-tools">아이콘 추가</div><div contenteditable="true" class="bn-editor"><div class="bn-block-column-list" style="display:flex"><div>왼쪽</div><div>오른쪽</div></div><input type="checkbox"><span class="bn-toolbar">도구</span></div></main>';
    document.body.append(source);source.querySelector('input').checked=true;
    const original=source.outerHTML;
    const html=(await freezeLiveSource(source,{title:'문서 제목'})).outerHTML;
    expect(html).toContain('문서 제목');expect(html).toContain('왼쪽');expect(html).toContain('오른쪽');expect(html).toContain('checked');
    expect(html).not.toContain('contenteditable');expect(html).not.toContain('도구');expect(html).not.toContain('아이콘 추가');
    expect(source.outerHTML).toBe(original);
  });
  it('keeps the checked state of checkboxes that were toggled after rendering',async()=>{
    const source=document.createElement('div');source.innerHTML='<input type="checkbox" id="on"><input type="checkbox" id="off">';document.body.append(source);source.querySelector('#on').checked=true;
    const copy=await freezeLiveSource(source,{title:''});
    expect(copy.querySelector('#on').hasAttribute('checked')).toBe(true);expect(copy.querySelector('#off').hasAttribute('checked')).toBe(false);
  });
  it('hides an explicit page break marker while keeping the content around it',async()=>{
    const source=document.createElement('div');source.innerHTML='<div class="bn-block-outer"><div data-content-type="pageBreak">페이지 나누기</div></div><p>다음 페이지</p>';document.body.append(source);
    const copy=await freezeLiveSource(source,{title:''});
    expect(copy.querySelector('[data-content-type="pageBreak"]').style.opacity).toBe('0');expect(copy.textContent).toContain('다음 페이지');
  });
  it('captures the current language selection rather than its original default',async()=>{
    const source=document.createElement('div');source.innerHTML='<select><option>Plain Text</option><option>JavaScript</option></select>';document.body.append(source);source.querySelector('select').selectedIndex=1;
    const html=(await freezeLiveSource(source,{title:''})).outerHTML;expect(html).toContain('JavaScript');expect(html).not.toContain('Plain Text');expect(html).not.toContain('<select');
  });
});
