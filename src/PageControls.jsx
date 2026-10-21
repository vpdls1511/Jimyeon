import React,{useState} from 'react';
import {minNumberMargin,pageSettings} from './page-settings';
import {NumberField,BlockSpacingControls} from './format-controls';

export function PageControls({editor,meta,patch,zoom,setZoom,count,state,pdfBusy,exportPDF}){
 const [open,setOpen]=useState(false),settings=pageSettings(meta);
 const apply=part=>patch({...pageSettings({...meta,...part}),small:false});
 return <div className="paperbar">
  <label>용지<select aria-label="용지 크기" value={settings.paper} onChange={e=>apply({paper:e.target.value})}><option>A4</option><option>A3</option></select></label>
  <NumberField label="기준 글자 크기" value={settings.fontSize} min={8} max={24} step={.5} unit="pt" onCommit={fontSize=>apply({fontSize})}/>
  <NumberField label="페이지 제목 크기" value={settings.titleFontSize} min={8} max={96} step={.5} unit="pt" onCommit={titleFontSize=>apply({titleFontSize})}/>
  <label>확대<select aria-label="편집 확대" value={zoom} onChange={e=>setZoom(e.target.value)}><option value="fit">너비 맞춤</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option></select></label>
  <span className="paper-count">{count||'—'} 페이지</span><span className="preview-state" role="status">{state}</span>
  <span className="paperbar-spacer"/><BlockSpacingControls editor={editor}/><button className={open?'active':''} aria-expanded={open} onClick={()=>setOpen(!open)}>페이지 설정</button>
  <button id="export-pdf" className="pdf-export" disabled={pdfBusy} onClick={exportPDF}>{pdfBusy?'PDF 생성 중…':'PDF 저장'}</button>
  {open&&<><div className="page-settings-dismiss" onClick={()=>setOpen(false)}/><section className="page-settings" aria-label="페이지 설정">
   <header><strong>페이지 설정</strong><button aria-label="페이지 설정 닫기" onClick={()=>setOpen(false)}>×</button></header>
   <p>페이지 제목 크기는 별도로 지정합니다. 본문과 내용 안의 제목은 기준 글자 크기에 따라 조정됩니다.</p>
   <div className="type-offsets">제목 1 +10pt · 제목 2 +6pt<br/>제목 3 +3pt · 제목 4 +1.5pt</div>
   <h3>문서 전체 서식</h3><div className="margin-inputs">
    <NumberField label="전체 행간" value={settings.lineHeight} min={1} max={3} step={.05} unit="배" onCommit={lineHeight=>apply({lineHeight})}/>
    <NumberField label="전체 자간" value={settings.letterSpacing} min={-1} max={5} step={.1} unit="pt" onCommit={letterSpacing=>apply({letterSpacing})}/>
    <NumberField label="기본 블록 간격" value={settings.blockGap} min={0} max={48} step={1} unit="pt" onCommit={blockGap=>apply({blockGap})}/>
   </div><label className="document-link-color">기본 링크 색상<input aria-label="기본 링크 색상" type="color" value={settings.linkColor} onChange={e=>apply({linkColor:e.target.value})}/><span>{settings.linkColor}</span></label>
   <p>기본 블록 간격은 각 블록 아래에 적용합니다. 개별 블록에서 지정한 여백·링크 색상이 우선합니다.</p>
   <h3>페이지 여백</h3><div className="margin-inputs">{[['marginTop','위 여백'],['marginBottom','아래 여백'],['marginLeft','왼쪽 여백'],['marginRight','오른쪽 여백']].map(([property,label])=><NumberField key={property} label={label} value={settings[property]} min={property==='marginBottom'&&settings.pageNumber!=='none'?minNumberMargin(settings.fontSize):0} max={60} unit="mm" onCommit={value=>apply({[property]:value})}/>)}</div>
   <h3>페이지 번호</h3><select aria-label="페이지 번호 위치" value={settings.pageNumber} onChange={e=>apply({pageNumber:e.target.value})}><option value="none">표시 안 함</option><option value="center">하단 중앙</option><option value="left">하단 왼쪽</option><option value="right">하단 오른쪽</option></select>
   <p>회색으로 현재 페이지/총 페이지를 표시합니다. 번호 사용 시 아래 여백은 최소 {minNumberMargin(settings.fontSize)}mm입니다.</p>
  </section></>}
 </div>;
}
