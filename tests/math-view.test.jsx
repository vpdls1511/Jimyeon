import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {MathView,prepareMath} from '../src/math-view';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const load=vi.hoisted(()=>{let resolve;const gate=new Promise(r=>{resolve=r});return {gate,resolve,factory:vi.fn(),render:vi.fn(expression=>`<span class="rendered-math">${expression}</span>`)}});
vi.mock('katex',async()=>{load.factory();await load.gate;return {default:{renderToString:load.render}}});

it('loads math only on use and waits for the rendered formula before PDF measurement',async()=>{
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 try{
  await prepareMath(node);expect(load.factory).not.toHaveBeenCalled();
  act(()=>root.render(<MathView expression="x^2" displayMode/>));
  expect(node.querySelector('[data-math-pending]')).not.toBeNull();
  let finished=false;const ready=prepareMath(node).then(()=>{finished=true});expect(finished).toBe(false);
  await act(async()=>{load.resolve();await load.gate});await ready;
  expect(node.querySelector('.rendered-math').textContent).toBe('x^2');expect(node.querySelector('[data-math-pending]')).toBeNull();
  expect(load.render).toHaveBeenCalledWith('x^2',expect.objectContaining({displayMode:true,trust:false}));
  act(()=>root.render(<MathView expression="x^3"/>));expect(node.querySelector('.rendered-math').textContent).toBe('x^3');expect(load.factory).toHaveBeenCalledOnce();
 }finally{act(()=>root.unmount());node.remove()}
});
it('does not silently print an unloaded formula after a loading error',async()=>{
 const node=document.createElement('div');node.innerHTML='<span data-math-error>failed</span>';
 await expect(prepareMath(node)).rejects.toThrow('수식을 불러오지 못했습니다.');
});
