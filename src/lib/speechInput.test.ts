import test from 'node:test';import assert from 'node:assert/strict';import {createSpeechInput} from './speechInput';
import {VoiceTurnDetector} from './voiceTurn';
test('voice turn tolerates natural pauses, rejects background noise and supports manual sending',()=>{
 const detector=new VoiceTurnDetector(2400);
 for(let n=100;n<=1000;n+=100)assert.equal(detector.sample(.004,n).heard,false);
 assert.equal(detector.sample(.04,1100).heard,false);
 detector.sample(.04,1200);assert.equal(detector.sample(.04,1300).heard,true);
 assert.equal(detector.sample(.004,2700).finish,false);
 assert.equal(detector.sample(.04,2800).finish,false);
 assert.equal(detector.sample(.004,5100).finish,false);
 assert.equal(detector.sample(.004,5200).finish,true);
 const manual=new VoiceTurnDetector(0);for(let n=100;n<=500;n+=100)manual.sample(.04,n);assert.equal(manual.sample(.002,20000).finish,false);
});
test('microphone fills review text, stops, and ignores late events after disposal',()=>{
 let instance:any,transcript='',ended=false,error='';
 class Recognition {onresult:any;onend:any;onerror:any;stopped=false;aborted=false;constructor(){instance=this;}start(){}stop(){this.stopped=true;}abort(){this.aborted=true;}}
 const mic=createSpeechInput(Recognition,t=>transcript=t,()=>ended=true,e=>error=e);
 mic.start();instance.onresult({results:[Object.assign([{transcript:'Who is visiting today?'}],{isFinal:true})]});
 assert.equal(transcript,'Who is visiting today?');
 instance.onerror({error:'not-allowed'});assert.match(error,/permission/);
 mic.stop();assert.equal(instance.stopped,true);instance.onend();assert.equal(ended,true);
 const old=instance.onresult;mic.dispose();old({results:[Object.assign([{transcript:'late'}],{isFinal:true})]});assert.equal(transcript,'Who is visiting today?');assert.equal(instance.aborted,true);
});

test('finished speech automatically submits once, with the recognised text rather than old form state',()=>{
 let instance:any;const sent:string[]=[];
 class Recognition {onresult:any;onend:any;onerror:any;constructor(){instance=this;}start(){}stop(){}abort(){}}
 const mic=createSpeechInput(Recognition,()=>{},()=>{},()=>{},text=>sent.push(text));
 const result=(text:string)=>({results:[Object.assign([{transcript:text}],{isFinal:true})]});
 mic.start();instance.onresult(result('is anyone going to visit me'));instance.onresult(result('is anyone going to visit me'));instance.onend();instance.onend();
 assert.deepEqual(sent,['is anyone going to visit me']);
 mic.start();instance.onresult(result('What is my name?'));instance.onend();assert.equal(sent[1],'What is my name?');
 mic.start();instance.onresult(result('Do not send this'));mic.cancel();instance.onend();assert.equal(sent.length,2);
 mic.start();instance.onend();assert.equal(sent.length,2);
 mic.start();instance.onresult(result('Errored recording'));instance.onerror({error:'network'});instance.onend();assert.equal(sent.length,2);mic.dispose();
});
