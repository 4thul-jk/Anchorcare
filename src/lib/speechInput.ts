// Browser recognition can use its vendor speech service. It is not Gemini audio.
export function createSpeechInput(Ctor:any,onTranscript:(text:string)=>void,onEnd:()=>void,onError:(message:string)=>void,onQuestion?:(text:string)=>void){
 const recognition=new Ctor();recognition.lang='en-GB';recognition.continuous=false;recognition.interimResults=false;
 let active=true,finalText='',submitted=false,discard=false;
 recognition.onresult=(event:any)=>{
  if(!active||discard)return;
  const transcript=Array.from(event.results as any).filter((r:any)=>r.isFinal).map((r:any)=>r[0]?.transcript||'').join(' ').trim();
  if(transcript){finalText=transcript.slice(0,1000);onTranscript(finalText);}
 };
 recognition.onend=()=>{if(!active)return;onEnd();if(!discard&&finalText&&!submitted){submitted=true;onQuestion?.(finalText);}};
 recognition.onerror=(event:any)=>{discard=true;if(active)onError(event.error==='not-allowed'?'Microphone permission was denied. You can type your question.':'Could not hear your question. Please try again or type it.');};
 return {start:()=>{finalText='';submitted=false;discard=false;recognition.start();},stop:()=>recognition.stop(),cancel:()=>{discard=true;finalText='';recognition.abort();},dispose:()=>{active=false;discard=true;recognition.onresult=null;recognition.onend=null;recognition.onerror=null;recognition.abort();}};
}
