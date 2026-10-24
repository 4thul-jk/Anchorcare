import React, {useEffect, useRef, useState} from 'react';
import {createSpeechInput} from '../lib/speechInput';
export function VoiceQuestionInput({onTranscript,onQuestion,disabled}:{onTranscript:(text:string)=>void;onQuestion:(text:string)=>void;disabled:boolean}) {
 const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[error,setError]=useState('');
 const latest=useRef({onTranscript,onQuestion,disabled});latest.current={onTranscript,onQuestion,disabled};
 const input=useRef<ReturnType<typeof createSpeechInput>|null>(null);
 useEffect(()=>{
  const ctor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  setSupported(Boolean(ctor));
  if(ctor)input.current=createSpeechInput(ctor,text=>{if(!latest.current.disabled)latest.current.onTranscript(text);},()=>setListening(false),message=>{setError(message);setListening(false);},text=>{if(!latest.current.disabled)latest.current.onQuestion(text);});
  return()=>{input.current?.dispose();input.current=null;};
 },[]);
 useEffect(()=>{if(disabled){input.current?.cancel();setListening(false);}},[disabled]);
 return <div className="space-y-2">
  {supported?<button type="button" disabled={disabled} className="rounded-lg border px-4 py-3" onClick={()=>{setError('');try{if(listening)input.current?.stop();else{window.speechSynthesis?.cancel();input.current?.start();}setListening(!listening);}catch{setListening(false);setError('Could not start the microphone. Please type your question.');}}}>{listening?'Stop listening':'Speak your question'}</button>:<p className="text-sm text-slate-500">You can type your question. Microphone input is available in supported browsers.</p>}
  {listening&&<p role="status">Listening... Your question will be sent automatically when you finish speaking.</p>}
  {supported&&<p className="text-sm text-slate-500">Your browser handles speech recognition and may send audio to its speech service. Your finished question is sent automatically. You can also type and send a question.</p>}
  {listening&&<button type="button" className="border rounded px-3 py-2" onClick={()=>{input.current?.cancel();setListening(false);}}>Cancel recording</button>}
  {error&&<p role="alert">{error}</p>}
 </div>;
}
