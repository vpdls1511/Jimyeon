import React,{forwardRef,useCallback,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {capturePaperSource,collectStyles,paperSize,PX_PER_MM} from './paper';

export const PaperPreview=forwardRef(function PaperPreview({sourceRef,editor,meta,onCount,onState},ref){
  const stageRef=useRef(),pending=useRef(),visible=useRef(),counter=useRef(0),latest=useRef(meta);
  const debounce=useRef(),capturing=useRef(false),queued=useRef(false);
  const [layout,setLayout]=useState({width:paperSize(meta.paper).width*PX_PER_MM+48,height:1200});
  const [width,setWidth]=useState(500),[zoom,setZoom]=useState('fit'),[error,setError]=useState('');
  latest.current=meta;
  const render=useCallback(()=>{
    if(!sourceRef.current||!stageRef.current)return Promise.reject(Error('편집 화면을 준비하고 있습니다.'));
    if(pending.current){clearTimeout(pending.current.timeout);pending.current.frame.remove();pending.current.resolve(null)}
    const token=++counter.current,frame=document.createElement('iframe');
    frame.title='실제 용지 미리보기';
    frame.className='paper-frame pending';
    const size=paperSize(latest.current.paper);
    frame.style.width=(size.width*PX_PER_MM+48)+'px';
    frame.style.height='1200px';
    frame.src=new URL('preview.html',location.href).href;
    const payload={type:'render-paper',token,paper:latest.current.paper,html:capturePaperSource(sourceRef.current,latest.current),css:collectStyles()};
    setError('');onState('갱신 중…');
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{if(pending.current?.token===token){frame.remove();pending.current=null;setError('미리보기를 만들지 못했습니다. 다시 시도해 주세요.');onState('오류');reject(Error('미리보기 생성 시간이 초과되었습니다.'))}},45000);
      pending.current={frame,token,payload,resolve,reject,timeout};
      stageRef.current.append(frame);
    });
  },[sourceRef,onState]);

  useEffect(()=>{
    const receive=event=>{
      if(event.origin===location.origin&&event.data.type==='paper-request-export'&&event.source===visible.current?.contentWindow){document.querySelector('#export-pdf')?.click();return}
      const task=pending.current;
      if(!task||event.origin!==location.origin||event.source!==task.frame.contentWindow)return;
      if(event.data.type==='paper-frame-ready'){task.frame.contentWindow.postMessage(task.payload,location.origin);return}
      if(event.data.token!==task.token)return;
      if(event.data.type==='paper-ready'){
        clearTimeout(task.timeout);visible.current?.remove();task.frame.classList.remove('pending');visible.current=task.frame;
        task.frame.style.height=event.data.height+'px';setLayout({width:event.data.width,height:event.data.height});
        if(event.data.overflow)setError('일부 내용이 용지 여백을 벗어납니다. 해당 열이나 표의 너비를 줄여 주세요.');
        onCount(event.data.count);onState('최신 내용');pending.current=null;task.resolve(task.frame);
      }else if(event.data.type==='paper-error'){
        clearTimeout(task.timeout);task.frame.remove();pending.current=null;setError(event.data.message);onState('오류');task.reject(Error(event.data.message));
      }
    };
    window.addEventListener('message',receive);
    return()=>window.removeEventListener('message',receive);
  },[onCount,onState]);

  useEffect(()=>{
    const schedule=()=>{if(capturing.current){queued.current=true;return}onState('갱신 중…');clearTimeout(debounce.current);debounce.current=setTimeout(()=>render().catch(()=>{}),350)};
    schedule();
    const stop=editor.onChange(schedule);
    const observer=new MutationObserver(schedule);
    if(sourceRef.current)observer.observe(sourceRef.current,{childList:true,subtree:true,attributes:true,attributeFilter:['style','src','data-state','data-toggled']});
    return()=>{clearTimeout(debounce.current);stop();observer.disconnect()};
  },[editor,meta,render,onState,sourceRef]);

  useEffect(()=>{
    const node=stageRef.current.closest('.paper-scroll');
    const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));observer.observe(node);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>()=>{if(pending.current){clearTimeout(pending.current.timeout);pending.current.resolve(null)}},[]);
  useImperativeHandle(ref,()=>({async getPrintJob(){clearTimeout(debounce.current);capturing.current=true;try{const frame=await render();if(!frame)throw Error('페이지가 변경되었습니다. 다시 PDF 저장을 눌러 주세요.');return frame.contentWindow.createPrintJob()}finally{capturing.current=false;if(queued.current){queued.current=false;debounce.current=setTimeout(()=>render().catch(()=>{}),350)}}}}),[render]);

  const scale=zoom==='fit'?Math.min(1,(Math.max(240,width)-8)/layout.width):Number(zoom);
  return <section className="paper-panel" aria-label="출력 미리보기">
    <div className="preview-caption"><span>출력 미리보기 · {meta.paper} · {paperSize(meta.paper).width} × {paperSize(meta.paper).height} mm</span><select aria-label="미리보기 확대" value={zoom} onChange={e=>setZoom(e.target.value)}><option value="fit">너비 맞춤</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></div>
    <div className="paper-scroll"><div className="paper-scaled" style={{width:layout.width*scale,height:layout.height*scale}}><div className="paper-stage" ref={stageRef} style={{width:layout.width,height:layout.height,transform:`scale(${scale})`}}/></div></div>
    {error&&<div className="preview-error" role="alert">{error}<button onClick={()=>render().catch(()=>{})}>다시 시도</button></div>}
  </section>;
});
