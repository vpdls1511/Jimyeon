import React,{useEffect,useRef,useState} from 'react';
import {DOCUMENT_FORMATS} from './document-export';

export function SaveDocumentDialog({onSave,onClose}){
 const [format,setFormat]=useState('jimyeon'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const dialog=useRef(null),inFlight=useRef(false);
 useEffect(()=>{const previous=document.activeElement;dialog.current.querySelector('select').focus();return()=>previous?.isConnected&&previous.focus()},[]);
 const close=()=>{if(!inFlight.current)onClose()};
 async function save(event){
  event.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
  try{if(await onSave(format)!==false)onClose()}catch(error){setError(error.message||'문서를 저장하지 못했습니다.')}finally{inFlight.current=false;setBusy(false)}
 }
 function keys(event){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}
  if(event.key==='Tab'){
   const controls=[...dialog.current.querySelectorAll('select:not(:disabled),button:not(:disabled)')];
   if(!controls.length){event.preventDefault();return}
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
 }
 return <div className="modal-backdrop" onClick={event=>{if(event.target===event.currentTarget)close()}}>
  <form ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby="save-document-title" onSubmit={save} onKeyDown={keys}>
   <h2 id="save-document-title">문서 저장</h2>
   <label>저장 형식<select value={format} disabled={busy} onChange={event=>setFormat(event.target.value)}>{DOCUMENT_FORMATS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
   <p>{format==='md'?'Markdown은 열 배치·이미지 정렬·페이지 설정 등 세부 서식을 모두 보존하지 못합니다. 원본 보존에는 지면 또는 JSON 문서를 사용하세요.':'블록·열·이미지·페이지 설정을 함께 보존합니다.'}</p>
   {error&&<p role="alert">{error}</p>}
   <div className="modal-actions"><button type="button" disabled={busy} onClick={close}>취소</button><button type="submit" className="primary" disabled={busy}>{busy?'저장 중…':'저장'}</button></div>
  </form>
 </div>;
}
