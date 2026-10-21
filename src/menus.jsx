import React,{useEffect,useState} from 'react';
import {useBlockNoteEditor,useComponentsContext,useExtensionState,AddBlockButton,BlockColorsItem,TableColumnHeaderItem,TableRowHeaderItem,SideMenu} from '@blocknote/react';
import {selectedBlockIds,selectBlocks} from './block-selection';
import {arrangeColumns,canArrangeColumns,insertColumnRow} from './columns';
import {SideMenuExtension,insertOrUpdateBlockForSlashMenu} from '@blocknote/core/extensions';
import {Copy,Trash2,Link,ArrowRightLeft,Palette,Quote,Text,Lightbulb,Sigma,Link2,Code,Columns2,ListTree,MousePointer2} from 'lucide-react';
import {formatTargets,COLOR_OPTIONS,TEXT_COLORS} from './block-format';
import {dividerOpacity} from './divider-opacity';
import {BlockDragHandle} from './BlockDragHandle';
export function cloneBlocks(blocks){return blocks.map(b=>{const n=structuredClone(b);delete n.id;n.children=cloneBlocks(n.children||[]);return n})}
export const selectedOrCurrent=formatTargets;
export function updateSelectedBlocks(editor,block,update,filter=()=>true){
 if(!editor.isEditable)return false;
 // BlockNote forbids reading prosemirrorState during an active transaction.
 // Resolve the selection first, then apply the whole menu action atomically.
 const targets=selectedOrCurrent(editor,block).filter(filter);if(!targets.length)return false;
 editor.transact(()=>targets.forEach(target=>editor.updateBlock(target,update)));editor.focus();return true;
}
export function duplicate(editor,block){
 if(!editor.isEditable)return;
 const blocks=selectedOrCurrent(editor,block),groups=new Map(),range=selectedBlockIds(editor).length>0&&(!block||selectedBlockIds(editor).includes(block.id));
 if(range){const selection=editor.prosemirrorState.selection;for(const entry of selection.entries){const parent=editor.prosemirrorState.doc.resolve(entry.pos).parent;const group=groups.get(parent)||[];group.push(editor.getBlock(entry.id));groups.set(parent,group)}}else groups.set(null,blocks);
 const inserted=[];editor.transact(()=>{for(const group of groups.values())inserted.push(...editor.insertBlocks(cloneBlocks(group),group.at(-1),'after'))});
 selectBlocks(editor,inserted.map(b=>b.id));editor.focus();
}
const conversions=[['텍스트','paragraph'],['제목 1','heading',{level:1}],['제목 2','heading',{level:2}],['제목 3','heading',{level:3}],['제목 4','heading',{level:4}],['글머리 기호 목록','bulletListItem'],['번호 매기기 목록','numberedListItem'],['할 일 목록','checkListItem'],['토글 목록','toggleListItem'],['인용','quote'],['콜아웃','callout'],['토글 제목 1','heading',{level:1,isToggleable:true}],['토글 제목 2','heading',{level:2,isToggleable:true}],['토글 제목 3','heading',{level:3,isToggleable:true}],['코드','codeBlock']];
export function setDividerOpacity(editor,block,value){
 if(!editor.isEditable)return false;
 const targets=selectedOrCurrent(editor,block).filter(target=>target.type==='divider');if(!targets.length)return false;
 const opacity=dividerOpacity(value);
 // Keep focus on the slider while dragging or using its arrow keys.
 editor.transact(()=>targets.forEach(target=>editor.updateBlock(target,{props:{opacity}})));return true;
}
function DividerAppearance({editor,block}){
 const [opacity,setOpacity]=useState(()=>dividerOpacity(editor.getBlock(block.id)?.props.opacity));
 useEffect(()=>{const sync=()=>setOpacity(dividerOpacity(editor.getBlock(block.id)?.props.opacity));sync();return editor.onChange(sync)},[editor,block.id]);
 return <div className="divider-color-control"><span><Palette size={14}/>구분선 색상</span><div className="color-swatches">{COLOR_OPTIONS.map(([color,name])=><button type="button" key={color} aria-label={`구분선 ${name}`} title={name} style={{backgroundColor:TEXT_COLORS[color]||'#7d797a'}} onClick={()=>updateSelectedBlocks(editor,block,{props:{textColor:color}},b=>b.type==='divider')}/>)}</div><label className="divider-opacity-control"><span>구분선 불투명도 <output>{opacity.toFixed(2)}</output></span><input type="range" aria-label="구분선 불투명도" aria-valuetext={opacity.toFixed(2)} min="0" max="1" step="0.05" value={opacity} onChange={event=>{const value=dividerOpacity(event.target.value);setOpacity(value);setDividerOpacity(editor,block,value)}}/></label></div>;
}
function RangeBlockColors({editor,block,Menu}){
 const colors=COLOR_OPTIONS;
 if(block.type==='divider')return <DividerAppearance editor={editor} block={block}/>;
 if(!selectedBlockIds(editor).includes(block.id))return <BlockColorsItem>색상</BlockColorsItem>;
 return <>{[['textColor','텍스트 색상'],['backgroundColor','배경 색상']].map(([property,label])=><Menu.Root sub position="right" key={property}><Menu.Trigger sub><Menu.Item subTrigger><Palette size={14}/>{label}</Menu.Item></Menu.Trigger><Menu.Dropdown sub>{colors.map(([color,name])=><Menu.Item key={color} onClick={()=>updateSelectedBlocks(editor,block,{props:{[property]:color}})}>{name}</Menu.Item>)}</Menu.Dropdown></Menu.Root>)}</>;
}
function ColumnLayoutMenu({editor,block,Menu}){
 const blocks=selectedOrCurrent(editor,block);if(!canArrangeColumns(editor,blocks))return null;
 return <Menu.Root sub position="right"><Menu.Trigger sub><Menu.Item subTrigger><Columns2 size={14}/>가로 배치</Menu.Item></Menu.Trigger><Menu.Dropdown sub>{[2,3,4,5].map(count=><Menu.Item key={count} onClick={()=>arrangeColumns(editor,blocks,count)}>{count}열로 배치</Menu.Item>)}</Menu.Dropdown></Menu.Root>;
}
export function NotionBlockMenu({dropdownRef}){const editor=useBlockNoteEditor(),C=useComponentsContext(),block=useExtensionState(SideMenuExtension,{editor,selector:s=>s?.block});if(!block)return null;const Menu=C.Generic.Menu;return <Menu.Dropdown ref={dropdownRef} className="bn-menu-dropdown bn-drag-handle-menu"><Menu.Root sub position="right"><Menu.Trigger sub><Menu.Item subTrigger>전환 <ArrowRightLeft size={14}/></Menu.Item></Menu.Trigger><Menu.Dropdown sub>{conversions.map(([name,type,props])=><Menu.Item key={name} onClick={()=>updateSelectedBlocks(editor,block,{type,props:props||{}})}>{name}</Menu.Item>)}</Menu.Dropdown></Menu.Root><RangeBlockColors editor={editor} block={block} Menu={Menu}/>{block.type==='image'&&<label className="image-alignment-control"><span>이미지 정렬</span><select aria-label="이미지 정렬" defaultValue={editor.getBlock(block.id)?.props.textAlignment||'left'} onChange={event=>updateSelectedBlocks(editor,block,{props:{textAlignment:event.target.value}},b=>b.type==='image')}><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label>}<ColumnLayoutMenu editor={editor} block={block} Menu={Menu}/><Menu.Item onClick={()=>duplicate(editor,block)}><Copy size={14}/> 복제 <span className="shortcut">⌘D</span></Menu.Item>{/* Desktop app URLs are app:// and cannot be opened outside it, so no block link is offered there. */}{!window.desktop&&<Menu.Item onClick={async()=>{try{await navigator.clipboard.writeText(location.href.split('#')[0]+'#block-'+block.id)}catch{alert('링크를 복사하지 못했습니다.')}}}><Link size={14}/> 블록 링크 복사</Menu.Item>}<TableRowHeaderItem>제목 행</TableRowHeaderItem><TableColumnHeaderItem>제목 열</TableColumnHeaderItem><Menu.Item onClick={()=>{if(editor.isEditable)editor.removeBlocks(selectedOrCurrent(editor,block));editor.focus()}}><Trash2 size={14}/> 삭제</Menu.Item><div className="menu-count">{selectedOrCurrent(editor,block).length}개 블록 · {plainText(selectedOrCurrent(editor,block)).trim().length}자</div></Menu.Dropdown>}
export const NotionSideMenu=props=><SideMenu {...props}><AddBlockButton/><BlockDragHandle menu={NotionBlockMenu}/></SideMenu>;
function plainText(blocks){return blocks.map(b=>(Array.isArray(b.content)?b.content.map(t=>t.text||t.content?.map(s=>s.text||'').join('')||'').join(''):'')+' '+plainText(b.children||[])).join(' ')}
export function extraSlashItems(editor){const make=(title,type,aliases,Icon,props={})=>({title,aliases,subtext:'',group:'기본 블록',icon:<Icon size={18}/>,onItemClick:()=>insertOrUpdateBlockForSlashMenu(editor,{type,props})});return [ {title:'복제',aliases:['duplicate','복사'],group:'작업',icon:<Copy size={18}/>,onItemClick:()=>duplicate(editor)},{title:'삭제',aliases:['delete','remove'],group:'작업',icon:<Trash2 size={18}/>,onItemClick:()=>editor.removeBlocks([editor.getTextCursorPosition().block])},...['default','gray','brown','orange','yellow','green','blue','purple','pink','red'].flatMap((color,i)=>[{title:['기본','회색','갈색','주황색','노란색','초록색','파란색','보라색','분홍색','빨간색'][i],aliases:[color,'color','color '+color],group:'텍스트 색상',icon:<Palette size={18}/>,onItemClick:()=>editor.updateBlock(editor.getTextCursorPosition().block,{props:{textColor:color}})},{title:['기본','회색','갈색','주황색','노란색','초록색','파란색','보라색','분홍색','빨간색'][i]+' 배경',aliases:[color+' background','color','배경'],group:'배경 색상',icon:<Palette size={18}/>,onItemClick:()=>editor.updateBlock(editor.getTextCursorPosition().block,{props:{backgroundColor:color}})}]),...[2,3,4,5].map(count=>({title:count+'열',aliases:[String(count),count+' columns','columns','열'],subtext:'현재 위치에 가로 행 추가 · 열 안에서도 사용',group:'기본 블록',icon:<Columns2 size={18}/>,onItemClick:()=>insertColumnRow(editor,count)})),{title:'탭',aliases:['tabs','탭','tab'],group:'고급 블록',icon:<Columns2 size={18}/>,onItemClick:()=>insertOrUpdateBlockForSlashMenu(editor,{type:'tabs',children:[{type:'tabPanel',props:{label:'탭 1'},children:[{type:'paragraph'}]},{type:'tabPanel',props:{label:'탭 2'},children:[{type:'paragraph'}]}]})},make('콜아웃','callout',['callout','설명','아이콘','강조'],Lightbulb),make('페이지 나누기','pageBreak',['page break','breakpage','페이지','나누기','구분'],Columns2),make('수식 블록','equation',['equation','math','latex','수학'],Sigma),make('웹 북마크','bookmark',['bookmark','url','링크'],Link2),make('임베드','embed',['embed','iframe','html'],Code),make('목차','tableOfContents',['toc','table of contents','목차'],ListTree),make('버튼','button',['button','버튼'],MousePointer2),{title:'인라인 수식',aliases:['inline equation','inline math','latex'],group:'인라인',icon:<Sigma size={18}/>,onItemClick:()=>{const expression=prompt('LaTeX 수식','');if(expression!==null)editor.insertInlineContent([{type:'inlineEquation',props:{expression}},' '])}}]}
