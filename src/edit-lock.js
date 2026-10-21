import {createExtension} from '@blocknote/core';
import {Plugin} from 'prosemirror-state';
// A read-only editor only stops typing. Block widgets, find and replace and undo/redo dispatch
// transactions directly, so a locked document rejects every document change here, in one place.
const ALLOW='allowWhileLocked';
export const editLock=createExtension(({editor})=>({key:'editLock',prosemirrorPlugins:[new Plugin({filterTransaction:tr=>!tr.docChanged||editor.isEditable||tr.getMeta(ALLOW)===true})]}));
// Switching documents or tabs is not editing the locked document, so it still applies.
export function allowWhileLocked(editor,change){return editor.transact(tr=>{tr.setMeta(ALLOW,true);return change()})}
// BlockNote draws the to-do checkbox and the code language select without reading the lock, so disable them in the DOM.
export function lockNativeControls(root,locked){if(!root||!locked)return;const ours=new Set(),apply=()=>root.querySelectorAll('input[type="checkbox"],select').forEach(el=>{if(!el.disabled){el.disabled=true;ours.add(el)}});apply();const observer=new MutationObserver(apply);observer.observe(root,{childList:true,subtree:true});return()=>{observer.disconnect();ours.forEach(el=>{el.disabled=false})}}
