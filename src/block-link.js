// Block DOM has no id attribute (only data-id), so the browser's native #fragment jump never fires; handle #block-<id> here.
export function goToBlockHash(editor,hash=location.hash){
 const m=/^#block-(.+)$/.exec(hash);if(!m)return false;
 let id;try{id=decodeURIComponent(m[1])}catch{return false}
 const block=editor.getBlock(id);if(!block)return false;
 [...document.querySelectorAll('.bn-block-outer')].find(n=>n.dataset.id===id)?.scrollIntoView({block:'center'});
 try{editor.setTextCursorPosition(block,'start');editor.focus()}catch{}
 return true;
}
