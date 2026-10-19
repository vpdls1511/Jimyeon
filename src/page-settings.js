export const PX_PER_MM=96/25.4;
export const PAGE_GAP=28;
export const PAGE_SIZES={A4:{width:210,height:297},A3:{width:297,height:420}};
const number=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;

export function pageSettings(meta={}){
 const pageNumber=['none','left','center','right'].includes(meta.pageNumber)?meta.pageNumber:'none';
 const fontSize=number(meta.fontSize,meta.small?10.5:12,8,24);
 return {
  paper:meta.paper==='A3'?'A3':'A4',
  fontSize,titleFontSize:number(meta.titleFontSize??(fontSize+18),fontSize+18,8,96),
  lineHeight:number(meta.lineHeight,1.5,1,3),
  letterSpacing:number(meta.letterSpacing,0,-1,5),
  blockGap:number(meta.blockGap,0,0,48),
  linkColor:/^#[\da-f]{6}$/i.test(meta.linkColor)?meta.linkColor:'#2365a8',
  marginTop:number(meta.marginTop,16,0,60),
  marginBottom:number(meta.marginBottom,16,pageNumber==='none'?0:8,60),
  marginLeft:number(meta.marginLeft,16,0,60),
  marginRight:number(meta.marginRight,16,0,60),pageNumber,
 };
}
export function pageMetrics(meta){
 const s=pageSettings(meta),size=PAGE_SIZES[s.paper];
 return {...s,width:size.width*PX_PER_MM,height:size.height*PX_PER_MM,top:s.marginTop*PX_PER_MM,bottom:s.marginBottom*PX_PER_MM,left:s.marginLeft*PX_PER_MM,right:s.marginRight*PX_PER_MM,bodyHeight:(size.height-s.marginTop-s.marginBottom)*PX_PER_MM,bodyWidth:(size.width-s.marginLeft-s.marginRight)*PX_PER_MM,stride:size.height*PX_PER_MM+PAGE_GAP};
}
export function pageVariables(meta){
 const p=pageMetrics(meta),base=p.fontSize*96/72;
 return {'--paper-width':p.width+'px','--paper-height':p.height+'px','--page-top':p.top+'px','--page-bottom':p.bottom+'px','--page-left':p.left+'px','--page-right':p.right+'px','--page-body-height':p.bodyHeight+'px','--body-size':base+'px','--title-size':p.titleFontSize*96/72+'px','--h1-size':(base+40/3)+'px','--h2-size':(base+8)+'px','--h3-size':(base+4)+'px','--h4-size':(base+2)+'px','--code-size':Math.max(10,base-8/3)+'px','--body-line-height':String(p.lineHeight),'--body-letter-spacing':p.letterSpacing+'pt','--block-gap':p.blockGap+'pt','--link-color':p.linkColor};
}
export function footerStyle(meta){
 const p=pageMetrics(meta);
 return {left:p.left+'px',right:p.right+'px',bottom:Math.max(3,p.marginBottom/2-2)*PX_PER_MM+'px',textAlign:p.pageNumber==='none'?'center':p.pageNumber,fontSize:Math.max(8,p.fontSize-3)*96/72+'px',color:'#929292'};
}

// Work in physical document pixels, independent of the screen zoom.
export function gapBefore(y,height,metrics){
 const page=Math.max(0,Math.floor((y+.01)/metrics.stride)),start=page*metrics.stride+metrics.top,end=page*metrics.stride+metrics.height-metrics.bottom;
 if(y<start-.5)return start-y;
 if(y+height>end+.5&&height<=metrics.bodyHeight+.5)return (page+1)*metrics.stride+metrics.top-y;
 return 0;
}
