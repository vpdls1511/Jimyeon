import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Menu} from '@mantine/core';
import {useBlockNoteEditor,useComponentsContext,useExtensionState,usePortalElement} from '@blocknote/react';
import {SideMenuExtension} from '@blocknote/core/extensions';
import {GripVertical} from 'lucide-react';
import {useOutsideDismiss} from './use-outside-dismiss';

export function BlockDragHandle({menu:BlockMenu}){
 const editor=useBlockNoteEditor(),C=useComponentsContext(),portal=usePortalElement();
 const side=editor.getExtension(SideMenuExtension);
 const block=useExtensionState(SideMenuExtension,{editor,selector:state=>state?.block});
 const [opened,setOpened]=useState(false),trigger=useRef(null),dropdown=useRef(null);
 const refs=useMemo(()=>[trigger,dropdown],[]),close=useCallback(()=>setOpened(false),[]);
 useOutsideDismiss(opened,refs,close);
 useEffect(()=>{if(!opened)return;side.freezeMenu();return()=>side.unfreezeMenu()},[opened,side]);
 if(!block)return null;
 return <Menu opened={opened} onChange={setOpened} position="left" withinPortal={!!portal} portalProps={portal?{target:portal}:undefined} returnFocus={false} middlewares={{flip:true,shift:true,inline:false,size:true}}>
  <Menu.Target><C.SideMenu.Button ref={trigger} label={editor.dictionary.side_menu.drag_handle_label} className="bn-button" draggable onDragStart={event=>side.blockDragStart(event,block)} onDragEnd={side.blockDragEnd} icon={<GripVertical size={24} data-test="dragHandle"/>}/></Menu.Target>
  <BlockMenu dropdownRef={dropdown}/>
 </Menu>;
}
