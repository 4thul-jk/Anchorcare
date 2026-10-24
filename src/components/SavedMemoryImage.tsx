import React,{useEffect,useState} from 'react';
export function SavedMemoryImage({image,accessKey}:{image:any;accessKey:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[large,setLarge]=useState(false);
 useEffect(()=>{const stop=new AbortController();let objectUrl='';setUrl('');setError('');
  void fetch('/api/engram/images/'+encodeURIComponent(image._id)+'/content',{headers:{'X-AnchorCare-Key':accessKey},signal:stop.signal,cache:'no-store'}).then(async r=>{
   if(!r.ok)throw Error('This saved picture is unavailable or no longer approved.');const blob=await r.blob();if(stop.signal.aborted)return;
   objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
  }).catch(e=>{if(!stop.signal.aborted)setError(e.message);});
  return()=>{stop.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[image._id,accessKey]);
 return <figure className="rounded-xl border bg-white p-3 space-y-2">
 {image.personName&&<h3 className="font-semibold">{image.personName}</h3>}
 {url?<img src={url} alt={image.caption} className={large?'w-full max-h-[75vh] object-contain rounded-lg':'w-full h-56 object-contain rounded-lg'} onError={()=>setError('Could not display this saved picture.')}/>:!error&&<p role="status">Loading saved picture...</p>}
 {error&&<p role="status" className="text-amber-800">{error}</p>}
 <figcaption><span className="text-sm text-slate-500">Caregiver label: </span>{image.caption}</figcaption>
 {url&&!error&&<button type="button" className="rounded border px-3 py-2 text-sm" onClick={()=>setLarge(!large)}>{large?'Smaller picture':'Enlarge picture'}</button>}
 </figure>;
}
