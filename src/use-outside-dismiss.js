import {useEffect} from 'react';

// Capture events before editor selection handlers can stop propagation.
// Menu submenus live inside the dropdown; the trigger must also count as inside.
export function useOutsideDismiss(opened,refs,onClose){
 useEffect(()=>{
  if(!opened)return;
  const doc=refs.find(ref=>ref.current)?.current.ownerDocument;
  if(!doc)return;
  const dismiss=event=>{
   const path=event.composedPath();
   if(refs.some(ref=>ref.current&&(path.includes(ref.current)||ref.current.contains(event.target))))return;
   onClose();
  };
  doc.addEventListener('pointerdown',dismiss,true);
  doc.addEventListener('click',dismiss,true);
  return()=>{doc.removeEventListener('pointerdown',dismiss,true);doc.removeEventListener('click',dismiss,true)};
 },[opened,refs,onClose]);
}
