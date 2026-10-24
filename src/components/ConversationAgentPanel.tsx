import React,{useEffect,useRef,useState} from 'react';
import {memoryApi} from '../lib/memoryApi';
const uid=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x=>x.toString(16).padStart(2,'0')).join('');
const encode=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not read recording'));reader.readAsDataURL(blob);});
function conversationId(){
 if(typeof window==='undefined')return 'server_preview';
 try{const existing=sessionStorage.getItem('anchorcare_conversation_id');if(existing)return existing;const id='chat_'+uid();sessionStorage.setItem('anchorcare_conversation_id',id);return id;}catch{return 'chat_'+uid();}
}
export function ConversationAgentPanel({accessKey,onQuestion}:{accessKey:string;onQuestion:(question:string,turnId:string)=>Promise<string|undefined>}){
 const[threadId,setThreadId]=useState(conversationId),[messages,setMessages]=useState<any[]>([]);
 const[value,setValue]=useState(''),[phase,setPhase]=useState(''),[error,setError]=useState(''),[last,setLast]=useState<any>(null),[busy,setBusy]=useState(false),[listening,setListening]=useState(false),[session,setSession]=useState(false),[camera,setCamera]=useState(false),[retain,setRetain]=useState(false),[speak,setSpeak]=useState(true),[cameraLive,setCameraLive]=useState(false);
 const alive=useRef(true),sessionRef=useRef(false),busyRef=useRef(false),cameraRef=useRef(false),retainRef=useRef(false),speakRef=useRef(true),version=useRef(0),request=useRef<AbortController|null>(null),recognition=useRef<any>(null),mic=useRef<MediaStream|null>(null),cam=useRef<MediaStream|null>(null),recorder=useRef<MediaRecorder|null>(null),video=useRef<HTMLVideoElement|null>(null),timer=useRef<any>(null),restart=useRef<any>(null),pending=useRef<any>(null);
 cameraRef.current=camera;retainRef.current=retain;speakRef.current=speak;
 useEffect(()=>{const controller=new AbortController();void memoryApi(accessKey,'/agent/history?session_id='+encodeURIComponent(threadId),undefined,controller.signal).then(d=>{if(!controller.signal.aborted)setMessages(d.turns.flatMap((t:any)=>[{role:'You',text:t.transcript,at:t.recordedAt},...(t.lastAnswer?[{role:'Companion',text:t.lastAnswer,at:t.answeredAt}]:[])]).slice(-20));}).catch(()=>{});return()=>controller.abort();},[accessKey,threadId]);
 function stamp(at:string){return new Intl.DateTimeFormat('en-GB',{timeZone:last?.timezone||'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(new Date(at));}
 function stopHardware(){recognition.current?.abort();recognition.current=null;const r=recorder.current;if(r?.state==='recording'){r.onstop=null;r.stop();}recorder.current=null;mic.current?.getTracks().forEach(t=>t.stop());mic.current=null;cam.current?.getTracks().forEach(t=>t.stop());cam.current=null;clearTimeout(timer.current);clearTimeout(restart.current);}
 function stop(){sessionRef.current=false;version.current++;request.current?.abort();stopHardware();window.speechSynthesis?.cancel();setSession(false);setListening(false);setCameraLive(false);setBusy(false);busyRef.current=false;setPhase('Conversation paused. Microphone and camera are off.');}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sessionRef.current=false;version.current++;request.current?.abort();stopHardware();window.speechSynthesis?.cancel();};},[accessKey]);
 function resume(){if(alive.current&&sessionRef.current)restart.current=setTimeout(()=>void listen(),500);}
 async function say(message:string){
  if(!speakRef.current||!message||!('speechSynthesis'in window))return;
  await new Promise<void>(resolve=>{const utterance=new SpeechSynthesisUtterance(message);utterance.lang='en-GB';utterance.rate=.9;utterance.onend=()=>resolve();utterance.onerror=()=>resolve();window.speechSynthesis.speak(utterance);});
 }
 async function snapshot(signal:AbortSignal){
  if(!cameraRef.current)return null;
  setPhase('Opening the camera for this information turn...');
  const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});
  if(signal.aborted||!alive.current||!cameraRef.current){stream.getTracks().forEach(t=>t.stop());return null;}
  cam.current=stream;setCameraLive(true);
  try{if(!video.current)throw Error('Camera preview unavailable');video.current.srcObject=stream;await video.current.play();await new Promise(r=>setTimeout(r,1000));if(signal.aborted||!cameraRef.current)return null;
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.getContext('2d')!.drawImage(video.current,0,0,640,480);return canvas.toDataURL('image/jpeg',.7).split(',')[1];
  }finally{stream.getTracks().forEach(t=>t.stop());cam.current=null;if(alive.current)setCameraLive(false);}
 }
 async function process(turn:any){
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');const epoch=version.current,stopper=new AbortController();request.current=stopper;pending.current=turn;
  try{
   setPhase('Gemini is listening to the meaning: question, information or both...');
   const classified=turn.classified||await memoryApi(accessKey,'/agent/turn',{turn_id:turn.id,session_id:turn.sessionId||threadId,...(turn.text?{transcript:turn.text}:{}),...(turn.audio?{audio_base64:turn.audio,mime_type:turn.mime}:{})},stopper.signal);
   turn.classified=classified;if(stopper.signal.aborted||epoch!==version.current)return;
   const isInfo=['information','mixed'].includes(classified.intent);
   let frame=turn.frame;
   if(isInfo&&cameraRef.current&&!turn.cameraAttempted){turn.cameraAttempted=true;try{frame=await snapshot(stopper.signal);turn.frame=frame;}catch{setError('Camera unavailable. Your words can still be saved without a picture.');}}
   if(stopper.signal.aborted||epoch!==version.current)return;
   setPhase(frame?'Processing the snapshot and saving your report for review...':'Saving your words and daily conversation topics...');
   const saved=await memoryApi(accessKey,'/agent/commit',{id:classified._id,...(frame?{image_base64:frame,camera_consent:true}:{}),...(turn.audio&&turn.keepAudio?{audio_base64:turn.audio,mime_type:turn.mime,audio_consent:true}:{})},stopper.signal);
   if(stopper.signal.aborted||epoch!==version.current)return;setLast(saved);pending.current=null;setMessages(previous=>[...previous,{role:'You',text:saved.transcript,at:saved.recordedAt}].slice(-20));
   const support=/^(?:i am lost|i'm lost|im lost|help me|call my|contact my|sos)\b/i.test(saved.transcript);
   if(['question','mixed'].includes(saved.intent)||support){setPhase('Checking your saved memories for an answer...');const answer=await onQuestion(saved.recallQuery||saved.question||saved.transcript,saved._id);if(epoch===version.current){if(answer)setMessages(previous=>[...previous,{role:'Companion',text:answer,at:new Date().toISOString()}].slice(-20));await say(answer||'');setPhase(answer?'Your answer is below. Ready for your next thought.':'Please check the reply or connection message below.');}}
   else{const message=saved.acknowledgement||'I have kept your words in our conversation.';setPhase(message);setMessages(previous=>[...previous,{role:'Companion',text:message,at:saved.savedAt}].slice(-20));await say(message);}
  }catch(e:any){if(!stopper.signal.aborted&&alive.current){setError(e.message||'Could not process this turn. Retry without recording again.');setPhase('This turn was not confirmed saved.');sessionRef.current=false;setSession(false);}}
  finally{if(epoch===version.current&&alive.current){setBusy(false);busyRef.current=false;setListening(false);resume();}}
 }
 async function listen(){
  if(busyRef.current||!sessionRef.current)return;
  setError('');const epoch=version.current;
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
   if(!alive.current||!sessionRef.current||epoch!==version.current){stream.getTracks().forEach(t=>t.stop());return;}
   mic.current=stream;const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
   const r=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);recorder.current=r;const chunks:BlobPart[]=[];let bytes=0,spoken='',ended=false;
   const Ctor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
   r.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>900000)finish();}};
   r.onstop=()=>{stream.getTracks().forEach(t=>t.stop());mic.current=null;setListening(false);if(epoch!==version.current||!alive.current)return;
    void(async()=>{if(Ctor&&!spoken){resume();return;}const blob=new Blob(chunks,{type:r.mimeType});if(blob.size>1024*1024)throw Error('Recording too large; please use a shorter sentence.');if(!spoken&&blob.size<1000){resume();return;}
     const audio=(!spoken||retainRef.current)?await encode(blob):null;await process({id:'turn_'+uid(),text:spoken||null,audio,mime:r.mimeType.split(';')[0],keepAudio:retainRef.current});})().catch(e=>{setError(e.message);sessionRef.current=false;setSession(false);});
   };
   function finish(){if(ended)return;ended=true;clearTimeout(timer.current);recognition.current?.stop();recognition.current=null;if(r.state==='recording')r.stop();}
   if(Ctor){const rec=new Ctor();recognition.current=rec;rec.lang='en-GB';rec.continuous=false;rec.interimResults=true;rec.onresult=(e:any)=>{spoken=Array.from(e.results).filter((x:any)=>x.isFinal).map((x:any)=>x[0].transcript).join(' ').trim();if(spoken)setValue(spoken);};rec.onend=finish;rec.onerror=(e:any)=>{if(e.error==='not-allowed'){sessionRef.current=false;setSession(false);setError('Speech recognition permission denied. You can type or use the recorded audio.');}finish();};rec.start();}
   r.start(250);timer.current=setTimeout(finish,30000);setListening(true);setPhase(Ctor?'Listening. Pause after a thought and I will respond.':'Recording. Press Finish this thought when ready.');
  }catch(e:any){stopHardware();setError(e.message||'Microphone unavailable. You can type instead.');setListening(false);setSession(false);sessionRef.current=false;}
 }
 return <section className="rounded-xl border bg-white p-5 space-y-4" aria-label="Conversation agent"><h2 className="text-xl font-semibold">Talk with your companion</h2><p>Start a conversation, then speak one thought at a time. I will check whether you are asking a question or sharing something to remember.</p>
 <div className="flex flex-wrap gap-3"><button className="rounded-lg bg-slate-900 text-white px-4 py-3" disabled={session||busy} onClick={()=>{sessionRef.current=true;setSession(true);void listen();}}>Start conversation</button><button className="rounded-lg border px-4 py-3" onClick={stop}>Stop conversation</button>{listening&&<button className="rounded-lg border px-4 py-3" onClick={()=>{recognition.current?.stop();const r=recorder.current;if(r?.state==='recording')r.stop();}}>Finish this thought</button>}</div>
 <div className="space-y-2 text-sm"><label className="block"><input type="checkbox" checked={camera} onChange={e=>{setCamera(e.target.checked);cameraRef.current=e.target.checked;if(!e.target.checked){cam.current?.getTracks().forEach(t=>t.stop());setCameraLive(false);}}}/> Allow a visible camera snapshot automatically when I share information</label><label className="block"><input type="checkbox" checked={retain} onChange={e=>setRetain(e.target.checked)}/> Keep original audio with this session’s reports for caregiver review</label><label className="block"><input type="checkbox" checked={speak} onChange={e=>{setSpeak(e.target.checked);if(!e.target.checked)window.speechSynthesis?.cancel();}}/> Read replies aloud</label><p>Microphone use starts only after you press Start. Camera capture is optional and occurs after classification; it cannot record what happened before it opened. Questions and reports enter a daily journal. Useful everyday information is saved automatically as your report. Camera images, medication details and active reminders have separate review safeguards.</p></div>
 <video ref={video} autoPlay playsInline muted className={cameraLive?'w-full max-w-sm rounded-lg border-2 border-red-500':'hidden'}/>{cameraLive&&<p role="status">Camera is on — taking one snapshot.</p>}
 <form className="flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();if(value.trim()&&!busy&&!listening)void process({id:'turn_'+uid(),text:value.trim(),keepAudio:false});}}><input className="flex-1 min-w-48 border rounded-lg p-3" aria-label="Conversation message" placeholder="Ask a question or tell me something..." value={value} disabled={busy||listening} onChange={e=>setValue(e.target.value)}/><button className="rounded-lg bg-slate-900 text-white px-4 py-3" disabled={busy||listening||!value.trim()}>Send</button></form>
 {phase&&<p role="status">{phase}</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}{pending.current&&!busy&&<button className="border rounded px-4 py-2" onClick={()=>void process(pending.current)}>Retry the same turn</button>}
 {messages.length>0&&<section aria-label="Conversation history" className="rounded-lg border p-3 space-y-3"><h3 className="font-semibold">Our conversation</h3>{messages.map((m,i)=><div key={i} className={m.role==='You'?'rounded bg-slate-100 p-3':'rounded bg-blue-50 p-3'}><p className="text-sm font-medium">{m.role} · {stamp(m.at)}</p><p>{m.text}</p></div>)}</section>}
 <button className="border rounded px-3 py-2" disabled={busy||session} onClick={()=>{const id='chat_'+uid();try{sessionStorage.setItem('anchorcare_conversation_id',id);}catch{}setThreadId(id);setMessages([]);setLast(null);setPhase('A new conversation is ready. Your saved memories are still available.');}}>Start a new conversation topic</button>
 {last&&<div className="rounded-lg bg-slate-50 p-3 space-y-2"><p>You said: {last.transcript}</p><p className="text-sm">Reported {stamp(last.recordedAt)} (Europe/London)</p><p>Understood as: {last.intent}</p>{last.outputs.map((o:any)=><p key={o.id}>{o.category.replaceAll('_',' ')} — {o.status==='available_report'?'saved and available to remember (your report)':o.status==='needs_review'?'date/scheduling detail needs review':'saved; caregiver review needed'}</p>)}{last.mediaIds.length>0&&<p>{last.mediaIds.length} capture file(s) saved privately for caregiver review.</p>}</div>}
 </section>;
}
