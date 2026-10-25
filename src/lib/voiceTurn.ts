export type VoicePhase='idle'|'listening'|'processing'|'speaking';
// Accumulate sustained speech, not a single click/cough; tolerate pauses between phrases.
export class VoiceTurnDetector{
 private noise=.004;private voicedMs=0;private lastVoice=0;private previous=0;
 constructor(private pauseMs=800){}
 sample(rms:number,now:number){
  const step=this.previous?Math.min(150,Math.max(0,now-this.previous)):100;this.previous=now;
  const threshold=Math.max(.012,this.noise*2.8);
  if(rms>threshold){this.voicedMs+=step;this.lastVoice=now;}
  else this.noise=this.noise*.97+Math.min(rms,.025)*.03;
  return {heard:this.voicedMs>=200,finish:this.pauseMs>0&&this.voicedMs>=200&&now-this.lastVoice>=this.pauseMs,level:Math.min(1,rms/.08)};
 }
}

