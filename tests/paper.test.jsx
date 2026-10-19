import {afterEach,describe,expect,it} from 'vitest';
import {capturePaperSource,collectStyles,paperCSS,paperSize} from '../src/paper';

afterEach(()=>document.body.replaceChildren());
describe('paper source shared by live preview and PDF',()=>{
  it('freezes active screen media instead of activating print or narrow-page rules',()=>{
    const style=document.createElement('style');style.textContent='@media screen {.screen{color:green}} @media print {.table{break-inside:avoid}} @media (max-width:800px) {.title{font-size:27px!important}} @font-face{font-family:test;src:url(./font.woff2)}';document.body.append(style);
    const doc={styleSheets:[style.sheet],baseURI:'app://editor/',defaultView:{matchMedia:query=>({matches:query==='screen'})}};
    const css=collectStyles(doc,{activeMediaOnly:true});
    expect(css).toContain('.screen');expect(css).not.toContain('@media');expect(css).not.toContain('.table');expect(css).not.toContain('.title');expect(css).toContain('app://editor/font.woff2');
    expect(collectStyles(doc)).toContain('@media print');
  });
  it('uses exact physical dimensions for A4 and A3',()=>{
    expect(paperSize('A4')).toEqual({width:210,height:297});
    expect(paperSize('A3')).toEqual({width:297,height:420});
    expect(paperCSS('A4')).toContain('size: 210mm 297mm; margin: 16mm');
    expect(paperCSS('A3')).toContain('size: 297mm 420mm; margin: 16mm');
  });
  it('retains content and columns, strips editing controls, and leaves the live editor untouched',()=>{
    const source=document.createElement('div');
    source.innerHTML='<main class="document"><textarea id="document-title"></textarea><div class="page-tools">아이콘 추가</div><div contenteditable="true" class="bn-editor"><div class="bn-block-column-list" style="display:flex"><div>왼쪽</div><div>오른쪽</div></div><div style="display:none">접힌 내용</div><input type="checkbox"><span class="bn-toolbar">도구</span></div></main>';
    document.body.append(source);source.querySelector('input').checked=true;
    const original=source.outerHTML;
    const html=capturePaperSource(source,{title:'문서 제목',font:'default',small:false});
    expect(html).toContain('문서 제목');expect(html).toContain('왼쪽');expect(html).toContain('오른쪽');expect(html).toContain('checked');
    expect(html).not.toContain('접힌 내용');expect(html).not.toContain('contenteditable');expect(html).not.toContain('도구');expect(html).not.toContain('아이콘 추가');
    expect(source.outerHTML).toBe(original);
  });
  it('turns an explicit page break into a print fragmentation boundary',()=>{
    const source=document.createElement('div');source.innerHTML='<div class="bn-block-outer"><div data-content-type="pageBreak">페이지 나누기</div></div><p>다음 페이지</p>';document.body.append(source);
    const html=capturePaperSource(source,{title:'',font:'default'});expect(html).toContain('manual-page-break');expect(html).not.toContain('페이지 나누기');expect(html).toContain('다음 페이지');expect(paperCSS('A4')).toContain('break-before:page');
  });
  it('uses the same static link card for interactive external media in preview and PDF',()=>{
    const source=document.createElement('div');source.innerHTML='<iframe src="https://example.com/embed"></iframe><video src="https://example.com/video.mp4"></video>';document.body.append(source);
    const html=capturePaperSource(source,{font:'default'});expect(html).toContain('https://example.com/embed');expect(html).toContain('print-media-card');expect(html).not.toContain('<iframe');expect(source.querySelector('iframe')).not.toBeNull();
  });
  it('captures the current language selection rather than its original default',()=>{
    const source=document.createElement('div');source.innerHTML='<select><option>Plain Text</option><option>JavaScript</option></select>';document.body.append(source);source.querySelector('select').selectedIndex=1;
    const html=capturePaperSource(source,{font:'default'});expect(html).toContain('JavaScript');expect(html).not.toContain('Plain Text');
  });
});
