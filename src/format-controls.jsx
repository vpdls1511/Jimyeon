import React,{useEffect,useState} from 'react';
import {FormattingToolbar,getFormattingToolbarItems,useBlockNoteEditor,useEditorState} from '@blocknote/react';
import {COLOR_OPTIONS,formatTargets,linkRanges,setBlockSpacing,setLinkColor} from './block-format';

export function NumberField({label,value,onCommit,min,max,step=1,unit}){
 const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 const commit=()=>{if(draft.trim()===''||!Number.isFinite(Number(draft))){setDraft(String(value));return}const next=Math.min(max,Math.max(min,Number(draft)));setDraft(String(next));if(next!==value)onCommit(next)};
 return <label className="page-number-input"><span>{label}</span><input aria-label={label} type="number" value={draft} min={min} max={max} step={step} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.target.blur()}}/><span className="input-unit">{unit}</span></label>;
}
function SpacingField({label,value,mixed,onCommit}){
 const [draft,setDraft]=useState(value);
 useEffect(()=>setDraft(value),[value]);
 return <label className="page-number-input"><span>{label}</span><input aria-label={label} type="number" min="0" max="96" step="1" placeholder={mixed?'서로 다름':'기본'} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft===value)return;const n=draft===''?-1:Number(draft);if(Number.isFinite(n))onCommit(n)}} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();e.stopPropagation()}}/><span>pt</span></label>;
}
export function BlockSpacingControls({editor}){
 const [ids,setIds]=useState(null),[,refresh]=useState(0);
 useEffect(()=>editor.onChange(()=>refresh(n=>n+1)),[editor]);
 const blocks=(ids||[]).map(id=>editor.getBlock(id)).filter(Boolean);
 const common=property=>{const values=blocks.map(b=>b.props[property]);return values.length&&values.every(v=>v===values[0])&&values[0]>=0?String(values[0]):''};
 const mixed=property=>blocks.some(b=>b.props[property]!==blocks[0]?.props[property]);
 const apply=values=>setBlockSpacing(editor,ids,values);
 return <>
  <button className="block-selection-tools" aria-expanded={!!ids} disabled={!editor.isEditable} onMouseDown={e=>e.preventDefault()} onClick={()=>setIds(ids?null:formatTargets(editor).filter(b=>'spaceBefore' in b.props).map(b=>b.id))}>블록 여백</button>
  {ids&&<><div className="page-settings-dismiss" onClick={()=>setIds(null)}/><section className="page-settings block-spacing-settings block-selection-tools" aria-label="블록 여백 설정">
   <header><strong>블록 여백 · {blocks.length}개 선택</strong><button aria-label="블록 여백 닫기" onClick={()=>setIds(null)}>×</button></header>
   <p>현재 블록 또는 선택한 여러 블록에 적용합니다. 빈 값은 문서 기본값을 따릅니다.</p>
   {blocks.length?<><div className="margin-inputs"><SpacingField label="블록 위 여백" value={common('spaceBefore')} mixed={mixed('spaceBefore')} onCommit={spaceBefore=>apply({spaceBefore})}/><SpacingField label="블록 아래 여백" value={common('spaceAfter')} mixed={mixed('spaceAfter')} onCommit={spaceAfter=>apply({spaceAfter})}/></div>
   <button className="reset-spacing" onClick={()=>apply({spaceBefore:-1,spaceAfter:-1})}>문서 기본값 따르기</button></>:<p>본문·이미지·구분선 등 편집할 블록을 먼저 선택하세요.</p>}
   <p>⌘/Ctrl + ⌥/Alt + ↑ 위 여백 +2pt<br/>⌘/Ctrl + ⌥/Alt + ↓ 아래 여백 +2pt<br/>Shift를 함께 누르면 2pt 줄입니다.</p>
  </section></>}
 </>;
}
function LinkColorControl(){
 const editor=useBlockNoteEditor();
 const state=useEditorState({editor,selector:({editor})=>({available:linkRanges(editor).length>0,color:editor.getActiveStyles().textColor||'default'})});
 if(!state.available)return null;
 const known=COLOR_OPTIONS.some(([color])=>color===state.color);
 return <label className="link-color-control"><span>링크 색</span><select aria-label="선택 링크 색상" value={state.color} onChange={e=>setLinkColor(editor,e.target.value)}>{!known&&<option value={state.color}>사용자 색</option>}{COLOR_OPTIONS.map(([color,label])=><option key={color} value={color}>{label}</option>)}</select></label>;
}
export function ResumeFormattingToolbar(){return <FormattingToolbar>{getFormattingToolbarItems()}<LinkColorControl/></FormattingToolbar>}
