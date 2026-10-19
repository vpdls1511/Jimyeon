import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {createLivePaginator} from './live-pagination';
import {footerStyle,pageMetrics,pageVariables,PAGE_GAP} from './page-settings';
import {livePrintJob} from './live-print';
import {prepareMath} from './math-view';

export const LivePaperEditor=forwardRef(function LivePaperEditor({sourceRef,editor,meta,onCount,onState,zoom,selectedCount,children},ref){
 const panelRef=useRef(),paginator=useRef(),latest=useRef(meta),[width,setWidth]=useState(1000);
 const [layout,setLayout]=useState(()=>({count:1,height:pageMetrics(meta).height,warnings:[]}));
 latest.current=meta;
 const metrics=pageMetrics(meta),scale=zoom==='fit'?Math.min(1,Math.max(.3,(width-64)/metrics.width)):Number(zoom);
 useEffect(()=>{
  paginator.current=createLivePaginator({editor,source:sourceRef.current,getMeta:()=>latest.current,onState,onLayout:value=>{setLayout(value);onCount(value.count)}});
  return()=>paginator.current?.destroy();
 },[editor,sourceRef,onCount,onState]);
 useEffect(()=>paginator.current?.schedule(),[meta,scale]);
 useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));observer.observe(panelRef.current);return()=>observer.disconnect()},[]);
 useImperativeHandle(ref,()=>({async getPrintJob(){await prepareMath(sourceRef.current);const value=await paginator.current.flush();onState('PDF 배치 고정 중…');const job=await livePrintJob(sourceRef.current,latest.current,value);onState('PDF 파일 생성 중…');return job}}),[sourceRef,onState]);
 return <section ref={panelRef} className="editing-panel live-paper-panel" aria-label="페이지 편집">
  <div className="editor-label">페이지에서 바로 편집 · 여백에서 드래그하여 블록 선택{selectedCount>0&&<span className="block-selection-count" role="status">{selectedCount}개 블록 선택 · ⌘C 복사 · Delete 삭제 · Esc 해제</span>}</div>
  <div className="live-paper-stage" style={{width:metrics.width*scale,height:layout.height*scale}}>
   <div className="live-paper-canvas" style={{width:metrics.width,height:layout.height,transform:`scale(${scale})`,...pageVariables(meta)}}>
    <div className="live-paper-sheets" aria-hidden="true">{Array.from({length:layout.count},(_,index)=><div className="live-sheet" key={index} style={{top:index*metrics.stride,height:metrics.height}}/>)}</div>
    <div id="editing-document" className="live-document" ref={sourceRef} style={pageVariables(meta)}>{children}</div>
    <div className="live-paper-margins" aria-hidden="true">{Array.from({length:layout.count},(_,index)=><React.Fragment key={index}>
     {index>0&&<div className="live-margin-mask" style={{top:index*metrics.stride,height:metrics.top}}/>}
     <div className="live-margin-mask" style={{top:index*metrics.stride+metrics.height-metrics.bottom,height:metrics.bottom}}/>
     {index<layout.count-1&&<div className="live-page-gutter" style={{top:index*metrics.stride+metrics.height,height:PAGE_GAP}}/>}
     {metrics.pageNumber!=='none'&&<div className="live-page-footer" data-page-number={index+1} style={{top:index*metrics.stride,height:metrics.height}}><span style={footerStyle(meta)}>{index+1}/{layout.count}</span></div>}
    </React.Fragment>)}</div>
   </div>
  </div>
  {layout.warnings.length>0&&<div className="pagination-warning" role="alert">{layout.warnings[0]}</div>}
 </section>;
});
