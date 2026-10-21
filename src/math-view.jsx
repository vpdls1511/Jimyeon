import React,{useEffect,useMemo,useState} from 'react';

let engine,loading;
export function loadMathRenderer(){
 if(!loading)loading=import('katex').then(module=>{engine=module.default;return engine}).catch(error=>{loading=undefined;throw error});
 return loading;
}

export function MathView({expression,displayMode}){
 const [math,setMath]=useState(()=>engine),[failed,setFailed]=useState(false);
 useEffect(()=>{if(math)return;let active=true;loadMathRenderer().then(value=>{if(active)setMath(value)},()=>{if(active)setFailed(true)});return()=>{active=false}},[math]);
 const html=useMemo(()=>{if(!math)return '';try{return math.renderToString(expression||'\\text{수식을 입력하세요}',{displayMode,throwOnError:false,trust:false})}catch{return '수식을 확인하세요'}},[math,expression,displayMode]);
 if(!math)return <span data-math-pending={failed?undefined:''} data-math-error={failed?'':undefined}>{failed?'수식을 불러오지 못했습니다.':expression||'수식 불러오는 중…'}</span>;
 // The empty-expression hint is marked so a printed page can leave it out.
 return <span data-math-hint={expression?undefined:''} dangerouslySetInnerHTML={{__html:html}}/>;
}

// Wait for lazy math views to commit before measuring page breaks or printing.
export async function prepareMath(source){
 if(source.querySelector('[data-math-error]'))throw Error('수식을 불러오지 못했습니다. 앱을 다시 열어 주세요.');
 if(!source.querySelector('[data-math-pending]'))return;
 await loadMathRenderer();
 await new Promise((resolve,reject)=>{
  const observer=new MutationObserver(check),timer=setTimeout(()=>{observer.disconnect();reject(Error('수식 표시를 마친 뒤 다시 시도해 주세요.'))},10000);
  function check(){if(!source.querySelector('[data-math-pending]')){observer.disconnect();clearTimeout(timer);resolve()}}
  observer.observe(source,{subtree:true,attributes:true,childList:true});check();
 });
}
