import React from 'react';
// React text nodes only: model Markdown is never inserted as HTML.
export function SessionReport({text}:{text:string}){
 const readable=text.replace(/`[a-f0-9]{64}`/g,'the recording').replace(/\b[a-f0-9]{64}\b/g,'the recording');
 return <div className="space-y-2">{readable.split('\n').map((line,i)=>{const heading=line.match(/^#{1,6}\s+(.+)$/);if(heading)return <h4 key={i} className="font-semibold mt-3">{heading[1]}</h4>;const item=line.replace(/^\s*[*-]\s+/,'');return item.trim()?<p key={i}>{item}</p>:null;})}</div>;
}
