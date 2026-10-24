import React,{useEffect,useState} from 'react';
import {memoryApi} from '../lib/memoryApi';import {SavedMemoryImage} from './SavedMemoryImage';
async function resizedImage(file:File){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image.');
 const bitmap=await createImageBitmap(file);try{
  const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image conversion unavailable');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/jpeg',0.82).split(',')[1];if(data.length>1398104)throw Error('Image is too large; choose a smaller picture.');return data;
 }finally{bitmap.close();}
}
export function ImageCaregiverPanel({accessKey}:{accessKey:string}){
 const [kind,setKind]=useState('person'),[target,setTarget]=useState(''),[caption,setCaption]=useState(''),[file,setFile]=useState<File|null>(null),[images,setImages]=useState<any[]>([]),[people,setPeople]=useState<any[]>([]),[episodes,setEpisodes]=useState<any[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){const [a,p,e]=await Promise.all([memoryApi(accessKey,'/admin/images'),memoryApi(accessKey,'/personal-records'),memoryApi(accessKey,'/ledger')]);setImages(a.images);setPeople(p.records.filter((r:any)=>r.person));setEpisodes(e.records.filter((r:any)=>r.isCurrent));}
 useEffect(()=>{setImages([]);setPeople([]);setEpisodes([]);setTarget('');let active=true;void Promise.all([memoryApi(accessKey,'/admin/images'),memoryApi(accessKey,'/personal-records'),memoryApi(accessKey,'/ledger')]).then(([a,p,e])=>{if(active){setImages(a.images);setPeople(p.records.filter((r:any)=>r.person));setEpisodes(e.records.filter((r:any)=>r.isCurrent));}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[accessKey]);
 async function act(task:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await task();await load();}catch(e){setError(e instanceof Error?e.message:'Image request failed');}finally{setBusy(false);}}
 return <section className="rounded-xl border bg-white p-5 space-y-4"><h2 className="font-semibold">Familiar people and memory pictures</h2>
 <p>Upload a picture you are authorised to share, link it to a person or memory, and approve it for the companion. Captions are caregiver labels; the app does not identify faces.</p>
 {error&&<p role="alert" className="text-red-700">{error}</p>}{message&&<p role="status">{message}</p>}
 <form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(async()=>{if(!file)throw Error('Choose an image first');const image_base64=await resizedImage(file);await memoryApi(accessKey,'/admin/images',{target_type:kind,target_id:target,caption,content_type:'image/jpeg',image_base64});setMessage('Picture saved as a draft. Review it and approve before patient recall.');});}}>
 <label className="block">Link picture to<select className="border rounded p-2 block w-full" value={kind} onChange={e=>{setKind(e.target.value);setTarget('');}}><option value="person">Familiar person</option><option value="episode">Saved memory</option></select></label>
 <label className="block">Choose a person or memory<select className="border rounded p-2 block w-full" required value={target} onChange={e=>setTarget(e.target.value)}><option value="">Select...</option>{kind==='person'?people.map(r=><option key={r._id} value={r.personId}>{r.person.name} - {r.person.relationship}</option>):episodes.map(r=><option key={r.id} value={r.id}>{r.summary.slice(0,120)} ({r.reviewStatus})</option>)}</select></label>
 <label className="block">Caption<input className="border rounded p-2 block w-full" value={caption} onChange={e=>setCaption(e.target.value)} required maxLength={500} placeholder="Describe who or what this saved picture shows"/></label>
 <label className="block">Picture<input className="block mt-1" type="file" accept="image/png,image/jpeg,image/webp" required onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
 <button disabled={busy||!target} className="border rounded px-4 py-2">Upload draft picture</button></form>
 <button disabled={busy} className="border rounded px-4 py-2" onClick={()=>void act(load)}>Refresh pictures</button>
 <div className="grid md:grid-cols-2 gap-4">{images.map(image=><div key={image._id}><SavedMemoryImage image={image} accessKey={accessKey}/><p className="text-sm mt-2">{image.reviewStatus} | {image.targetType}</p><button disabled={busy} className="border rounded px-3 py-2 mt-2" onClick={()=>void act(async()=>{await memoryApi(accessKey,'/admin/images/review',{image_id:image._id,status:image.reviewStatus==='approved'?'draft':'approved'});})}>{image.reviewStatus==='approved'?'Withdraw image approval':'Approve this picture'}</button></div>)}</div>
 </section>;
}
