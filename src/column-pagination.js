// Paged.js follows one DOM flow at a time. Split parallel columns into bounded
// fragments first so a long left column cannot push the right column away.
// This runs only on the connected, read-only measurement copy.
export function fragmentColumns(root, pageHeight) {
  const origin = root.getBoundingClientRect().top;
  for (const layout of [...root.querySelectorAll('.bn-block-column-list')]) {
    const columns = [...layout.children];
    if (!columns.length) continue;
    const available = Math.max(96, pageHeight - ((layout.getBoundingClientRect().top - origin) % pageHeight) - 40);
    if (layout.getBoundingClientRect().height <= available) continue;
    const fragments = document.createElement('div');
    fragments.className = 'print-column-fragments';
    const template = layout.cloneNode(false);
    let first = true, guard = 0;
    while (columns.some(column => column.textContent.trim() || column.querySelector('img,svg,table,hr')) && guard++ < 300) {
      const limit = first ? available : pageHeight - 24;
      const row = template.cloneNode(false);
      row.classList.add('print-column-fragment');
      row.style.breakInside = 'avoid';
      if (!first) row.style.breakBefore = 'page';
      let consumed = false;
      for (const column of columns) {
        const piece = column.cloneNode(false);
        const cut = findCut(column, limit);
        if (cut) {
          const range = document.createRange();
          range.setStart(column, 0);range.setEnd(cut.node, cut.offset);
          piece.append(range.extractContents());
          // A continued list item keeps its indentation without another marker.
          const continued = column.querySelector('.bn-block-content');
          const previous = piece.querySelector('.bn-block-content:last-child');
          if (continued && previous && continued.closest('[data-id]')?.dataset.id === previous.closest('[data-id]')?.dataset.id) continued.dataset.printContinued = 'true';
          removeEmpty(column);
          consumed = true;
        }
        row.append(piece);
      }
      if (!consumed) {
        if (first) { first = false; continue; }
        // An indivisible oversized element is kept whole and constrained by the
        // shared paper stylesheet, rather than dropped from the document.
        columns.forEach((column,i) => { if(column.firstElementChild) row.children[i].append(column.firstElementChild); });
      }
      fragments.append(row);first = false;
    }
    // Retain all remaining content even for unusual embedded block structures.
    if (columns.some(c => c.childNodes.length)) {
      const rest=template.cloneNode(false);rest.style.breakBefore='page';columns.forEach(c=>rest.append(c));fragments.append(rest);
    }
    layout.replaceWith(fragments);
  }
}

function removeEmpty(column) {
  for (const node of [...column.querySelectorAll('.bn-block-outer,.bn-block,.bn-block-content,p')].reverse()) {
    if (!node.textContent.trim() && !node.querySelector('img,svg,table,hr,input')) node.remove();
  }
}

function findCut(column, height) {
  const bottom=column.getBoundingClientRect().top+height;
  const walker=document.createTreeWalker(column,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
  let cut=null,node;
  while((node=walker.nextNode())) {
    if(node.nodeType===Node.ELEMENT_NODE) {
      if(node.matches('img,svg,hr,input')) {
        if(node.getBoundingClientRect().bottom>bottom) break;
        cut={node:node.parentNode,offset:[...node.parentNode.childNodes].indexOf(node)+1};
      }
      continue;
    }
    if(!node.textContent.length)continue;
    const range=document.createRange();range.selectNodeContents(node);
    const rects=[...range.getClientRects()];
    if(!rects.length)continue;
    if(rects.at(-1).bottom<=bottom){cut={node,offset:node.length};continue}
    let low=0,high=node.length;
    while(low<high){const mid=Math.ceil((low+high)/2);range.setEnd(node,mid);const last=[...range.getClientRects()].at(-1);if(last&&last.bottom<=bottom)low=mid;else high=mid-1}
    if(low)cut={node,offset:low};
    break;
  }
  return cut;
}

// Keep complete table rows on each sheet. Chromium's column fragmentation can
// otherwise leave the final row a few pixels below the printable area.
export function fragmentTables(root,pageHeight){
  for(const table of [...root.querySelectorAll('table')]){
    if(table.closest('.bn-block-column-list'))continue;
    const rows=[...table.rows];
    if(!rows.length)continue;
    const heights=rows.map(row=>row.getBoundingClientRect().height);
    const long=heights.reduce((sum,height)=>sum+height,0)>pageHeight-24;
    const headers=[];
    for(const row of rows){if([...row.cells].every(cell=>cell.tagName==='TH'))headers.push(row);else break}
    const headerHeight=headers.reduce((sum,row)=>sum+row.getBoundingClientRect().height,0);
    const data=rows.slice(headers.length);
    if(!data.length)continue;
    const cols=document.createElement('colgroup');
    [...rows[0].cells].forEach(cell=>{const col=document.createElement('col');col.style.width=cell.getBoundingClientRect().width+'px';cols.append(col)});
    const fragments=document.createElement('div');fragments.className='print-table-fragments';
    let current,body,used,limit,first=true;
    const next=()=>{current=table.cloneNode(false);current.classList.add('print-table-fragment');if(first&&long)current.classList.add('print-long-table-first');current.append(cols.cloneNode(true));if(headers.length){const head=document.createElement('thead');headers.forEach(row=>head.append(row.cloneNode(true)));current.append(head)}body=document.createElement('tbody');current.append(body);fragments.append(current);used=headerHeight+2;limit=pageHeight-24;first=false};
    next();
    data.forEach((row,index)=>{const height=heights[index+headers.length];if(body.children.length&&used+height>limit)next();body.append(row.cloneNode(true));used+=height;if(height>pageHeight-24)current.classList.add('oversized-table-row')});
    table.replaceWith(fragments);
  }
}
