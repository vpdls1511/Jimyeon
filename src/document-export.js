export const DOCUMENT_FORMATS = [
 {value:'jimyeon',label:'지면 문서 (.jimyeon)',type:'application/json'},
 {value:'json',label:'JSON 문서 (.json)',type:'application/json'},
 {value:'md',label:'Markdown (.md)',type:'text/markdown'},
];

export async function createDocumentExport(doc,format,toMarkdown){
 const option=DOCUMENT_FORMATS.find(option=>option.value===format);
 if(!option)throw Error('저장 형식을 선택하세요.');
 return {name:(doc.title||'문서')+'.'+format,type:option.type,
  text:format==='md'?await toMarkdown(doc.blocks):JSON.stringify(doc,null,2)};
}
