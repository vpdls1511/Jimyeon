import 'fake-indexeddb/auto';
import {vi} from 'vitest';
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
if(!window.matchMedia)window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
Range.prototype.getBoundingClientRect=()=>({top:0,left:0,bottom:0,right:0,width:0,height:0});
Range.prototype.getClientRects=()=>[];
HTMLElement.prototype.scrollIntoView=()=>{};
