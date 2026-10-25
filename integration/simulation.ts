import {publicSimulationOrigin} from './simulation-access';
import {ConversationAgent,classifyInput} from './conversation-agent';
import {randomUUID} from 'node:crypto';
import type {Express} from 'express';
import {config} from '../engram-retrieval/src/config.js';
import {createStore} from '../engram-retrieval/src/store.js';
import {EngramService} from '../engram-retrieval/src/service.js';
import {TeamContract} from '../engram-retrieval/src/team-contract.js';
import {LifeRecords} from '../engram-retrieval/src/life-records.js';
import {dayBounds,localDayKey,shiftDay} from '../engram-retrieval/src/memory-model.js';
import {companionClient,companionSettings} from './companion-provider';
import {MUSE_PERSONALITY} from './muse-personality';
import {verifyConversation} from './conversation';
import {localDemoAccess} from './demo-access';
import {RequestLimits} from './http-security';

export const SIM_ACTIONS:Record<string,{day?:number;hour:number;minute?:number;activity:string;label:string;text:string;room:string}>={
 caregiver_request:{hour:7,activity:'other',label:'Caregiver assistance requested',text:'Alex requested Sam’s assistance in the game.',room:'bedroom'},
 caregiver_arrived:{hour:7,activity:'other',label:'Caregiver arrived',text:'Sam arrived to offer Alex reassurance in the game.',room:'bedroom'},
 glasses_bed:{hour:9,activity:'other',label:'Glasses on bedside table',text:'Alex left his glasses on the bedside table.',room:'bedroom'},
 color_blue:{hour:9,activity:'other',label:'Favourite colour',text:'Alex said his favourite colour is blue.',room:'lounge'},
 color_green:{hour:9,activity:'other',label:'Favourite colour',text:'Alex said his favourite colour is green.',room:'lounge'},
 color_purple:{hour:9,activity:'other',label:'Favourite colour',text:'Alex said his favourite colour is purple.',room:'lounge'},
 breakfast:{hour:8,activity:'meal',label:'Breakfast',text:'Alex had oatmeal and Earl Grey tea for breakfast in the kitchen.',room:'kitchen'},
 glasses:{hour:9,activity:'other',label:'Glasses on shelf',text:'Alex left his glasses on the bookshelf beside the living-room window.',room:'lounge'},
 daughter:{hour:10,activity:'other',label:'Sarah visits',text:'Sarah Mercer, Alex’s daughter, visited Alex in the living room. They looked at their family photo album.',room:'lounge'},
 garden:{hour:11,activity:'exercise',label:'Garden walk',text:'Sam Rivera accompanied Alex on a 20-minute walk in the garden.',room:'garden'},
 reminder:{hour:13,minute:50,activity:'other',label:'Visit reminder',text:'The simulation clock reached the reminder time for David’s planned visit.',room:'bedroom'},
 lost:{hour:14,minute:5,activity:'other',label:'Outside familiar area',text:'Alex reported feeling lost near the simulated café. This is a simulated position, not real GPS.',room:'cafe'},
 contact:{hour:14,minute:10,activity:'other',label:'Simulated caregiver receipt',text:'The simulation displayed a caregiver acknowledgment. No real call, SMS or Telegram message was sent.',room:'cafe'},
 lunch:{hour:12,minute:30,activity:'meal',label:'Lunch',text:'Alex ate vegetable soup and bread in the kitchen with Sam.',room:'kitchen'},
 physio:{hour:14,minute:30,activity:'exercise',label:'David visits',text:'David Lee, Alex’s physiotherapist, visited and supervised seated leg exercises in the living room.',room:'lounge'},
 evening:{hour:18,activity:'meal',label:'Evening meal',text:'Alex had vegetable stew for dinner and listened to quiet piano music in the living room.',room:'lounge'},
 next_day:{day:1,hour:7,activity:'other',label:'Day two begins',text:'The simulation advanced to the second morning. This clock transition does not establish what happened overnight.',room:'bedroom'},
 breakfast2:{day:1,hour:8,activity:'meal',label:'Second breakfast',text:'Alex had toast, scrambled eggs and Earl Grey tea for breakfast in the kitchen.',room:'kitchen'},
 glasses2:{day:1,hour:9,activity:'other',label:'Glasses on counter',text:'Alex moved his glasses to the kitchen counter beside the kettle.',room:'kitchen'},
 reminder2:{day:1,hour:10,minute:50,activity:'other',label:'Sarah visit reminder',text:'The second-day simulation clock reached the reminder time for Sarah’s planned visit.',room:'bedroom'},
 daughter2:{day:1,hour:11,activity:'other',label:'Sarah returns',text:'Sarah Mercer visited Alex again and brought a drawing by Emma, his granddaughter.',room:'lounge'},
 garden2:{day:1,hour:12,activity:'exercise',label:'Rosemary watering',text:'Alex watered the rosemary plants with Sam in the courtyard garden.',room:'garden'},
 album_reminder:{day:1,hour:16,minute:50,activity:'other',label:'Album activity reminder',text:'The simulation clock reached the reminder time for a planned photo-album activity.',room:'lounge'},
 album2:{day:1,hour:17,activity:'other',label:'Remembering both days',text:'Alex sat with Sam and reviewed the family album and the available notes from the two-day simulation.',room:'lounge'}
};
type Run={id:string;patient:string;service:any;clock:Date;day:string;done:Set<string>;busy:boolean;expires:number;history:any[];sequence:number;spent:Record<string,number>;charged:Set<string>};
const TABLES=['people','personal_records','episodes','sources','daily_logs','plans','prompts','prompt_jobs','audit_events','simulation_receipts','agent_capture_turns','agent_capture_proposals','agent_identity_reports','agent_location_reports','agent_contact_offers'];
export class SimulationEngine {
 runs=new Map<string,Run>();
 constructor(private store:any,private cfg:any,private classifier=classifyInput){}
 budget(r:Run){const day=localDayKey(r.clock,this.cfg.timezone),total=this.cfg.simulationDailyXp||100;return {day,total,spent:r.spent[day]||0,remaining:Math.max(0,total-(r.spent[day]||0)),cost:5};}
 checkBudget(r:Run,key?:string){if(key&&r.charged.has(key))return;if(this.budget(r).remaining<5)throw Object.assign(Error('Today’s game XP is used. Advance to the next day or restart. SOS and clock controls remain available.'),{status:409});}
 spend(r:Run,key:string){if(r.charged.has(key))return;const day=localDayKey(r.clock,this.cfg.timezone);r.spent[day]=(r.spent[day]||0)+5;r.charged.add(key);}
 async start(){
  for(const [id,r]of this.runs)if(r.expires<Date.now())await this.remove(id);
  if(this.runs.size>=10)throw Object.assign(Error('The demo is full right now (10 active sessions). Please try again later or resume your existing session.'),{status:429});
  const id=randomUUID(),patient='sim_'+id.replaceAll('-',''),day=localDayKey(new Date(),this.cfg.timezone);
  const r:Run={id,patient,clock:new Date(+dayBounds(day,this.cfg.timezone).start+7*3600000),day,service:null,done:new Set(),busy:false,expires:Date.now()+7200000,history:[],sequence:0,spent:{},charged:new Set()};
  r.clock=this.time(r,7);
  const cfg={...this.cfg,householdId:'engram-simulation',subjectIds:[patient],quietStart:'00:00',quietEnd:'00:00',cooldownSeconds:0};
  r.service=new EngramService(this.store,cfg,()=>r.clock);this.runs.set(id,r);
  const life=new LifeRecords(r.service);
  try{
   for(const[key,name,relationship]of [['sarah','Sarah Mercer','daughter'],['sam','Sam Rivera','caregiver'],['david','David Lee','physiotherapist']]){
    await r.service.addPerson({subjectId:patient,id:patient+'_'+key,name,relationship});
    await life.addPersonal({patient_id:patient,id:patient+'_'+key+'_card',kind:'person',person_id:patient+'_'+key,title:name,original_text:`FICTIONAL SIMULATION: ${name} is Alex Mercer's ${relationship}.`,source_type:'caregiver_report'},true);
    await life.review({patient_id:patient,collection:'personal_records',id:patient+'_'+key+'_card',status:'approved'});
   }
   await life.addPersonal({patient_id:patient,id:patient+'_identity',kind:'fact',title:'Identity',original_text:'FICTIONAL SIMULATION: The patient is named Alex Mercer, aged 78. He prefers Earl Grey tea without sugar.',source_type:'caregiver_report'},true);
   await life.review({patient_id:patient,collection:'personal_records',id:patient+'_identity',status:'approved'});
   await r.service.createPlan({subjectId:patient,id:patient+'_visit',kind:'visit',personId:patient+'_david',eventStart:this.time(r,14).toISOString(),dueAt:this.time(r,13,50).toISOString(),expiresAt:this.time(r,15).toISOString()});
   await r.service.createPlan({subjectId:patient,id:patient+'_visit2',kind:'visit',personId:patient+'_sarah',eventStart:this.time(r,11,0,1).toISOString(),dueAt:this.time(r,10,50,1).toISOString(),expiresAt:this.time(r,12,0,1).toISOString()});
   await r.service.createPlan({subjectId:patient,id:patient+'_album2',kind:'photo_album',eventStart:this.time(r,17,0,1).toISOString(),dueAt:this.time(r,16,50,1).toISOString(),expiresAt:this.time(r,18,0,1).toISOString()});
   return await this.state(r);
  }catch(e){await this.remove(id);throw e;}
 }
 time(r:Run,h:number,m=0,offset=0){const b=dayBounds(shiftDay(r.day,offset),this.cfg.timezone),f=new Intl.DateTimeFormat('en-GB',{timeZone:this.cfg.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),target=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;for(let t=+b.start;t<+b.end;t+=60000)if(f.format(new Date(t))===target)return new Date(t);throw Error('Invalid simulation time');}
 get(id:string){const r=this.runs.get(id);if(!r||r.expires<Date.now())throw Object.assign(Error('This run has expired. Start a new simulation.'),{status:404});return r;}
 async state(r:Run){
  const scope=r.service.scope(r.patient),logs=await this.store.list('daily_logs',scope,{occurredAt:1,simulationOrder:1},1001);
  const currentDay=localDayKey(r.clock,this.cfg.timezone);
  const today=logs.filter((x:any)=>localDayKey(x.occurredAt,this.cfg.timezone)===currentDay);
  const latestGlasses=logs.filter((x:any)=>/^Glasses on/.test(x.label)).at(-1);
  const sceneFlags:string[]=[];
  if(today.some((x:any)=>/breakfast/i.test(x.label)))sceneFlags.push('breakfast');
  if(latestGlasses?.label==='Glasses on shelf')sceneFlags.push('glasses');
  if(latestGlasses?.label==='Glasses on counter')sceneFlags.push('glasses2');
  return {runId:r.id,patientId:r.patient,clock:r.clock,day:r.day,currentDay,dayNumber:currentDay===r.day?1:2,timezone:this.cfg.timezone,storage:this.store.mode,database:this.cfg.database||'memory',isolated:true,done:[...r.done],sceneFlags,budget:this.budget(r),history:r.history,logs,conversationTurns:await this.store.list('agent_capture_turns',scope,{recordedAt:-1},100),people:await this.store.list('people',scope,{},10),plans:await this.store.list('plans',scope,{},10),prompts:await this.store.list('prompts',scope,{createdAt:1},100),model:companionSettings().model};
 }
 async action(id:string,name:string,options:{sandbox?:boolean;requestId?:string;room?:string}={}){
  const r=this.get(id),a=SIM_ACTIONS[name];if(!a)throw Object.assign(Error('Unknown simulation action'),{status:400});
  if(r.busy)throw Object.assign(Error('Wait for the current action to finish.'),{status:409});
  r.busy=true;try{
   if(options.sandbox&&(!options.requestId||!/^[a-zA-Z0-9-]{8,80}$/.test(options.requestId)))throw Object.assign(Error('A valid action request ID is required.'),{status:400});
   const key=options.sandbox?name+'_'+options.requestId:name;
   if(r.done.has(key))return {...await this.state(r),replayed:true};
   const paid=!['caregiver_request','caregiver_arrived','next_day','lost','contact','reminder','reminder2','album_reminder'].includes(name);
   if(paid)this.checkBudget(r,key);
   if(r.sequence>=1000)throw Object.assign(Error('This run has reached 1000 recorded actions. Start a new run.'),{status:400});
   if(!options.sandbox&&a.day===1&&name!=='next_day'&&!r.done.has('next_day'))throw Object.assign(Error('Choose the second morning before this activity.'),{status:400});
   if(!options.sandbox&&!a.day&&r.done.has('next_day'))throw Object.assign(Error('That activity belongs to day one. Ask about yesterday instead.'),{status:400});
   if(name==='contact'&&!r.done.has('lost'))throw Object.assign(Error('First demonstrate the assistance offer.'),{status:400});
   if(!options.sandbox)await this.advanceClock(r,Math.max(0,(+this.time(r,a.hour,a.minute||0,a.day||0)-+r.clock)/60000));
   else if(name==='next_day')await this.advanceClock(r,Math.max(0,(+this.time(r,7,0,1)-+r.clock)/60000));
   const eventId=r.patient+'_'+key,team=new TeamContract(r.service),life=new LifeRecords(r.service);
   const careRoom=['bedroom','kitchen','lounge','garden','cafe'].includes(options.room||'')?options.room!:a.room;
   if(name==='caregiver_arrived'&&!r.done.has('caregiver_request'))throw Object.assign(Error('Request caregiver assistance first.'),{status:400});
   const description=name==='caregiver_request'?`Alex requested Sam’s assistance in the ${careRoom} in the game. No external message was sent.`:name==='caregiver_arrived'?`Sam arrived beside Alex in the ${careRoom} in the game and offered reassurance. This does not establish any improvement in Alex’s health.`:name==='daughter2'?'Sarah Mercer visited Alex and brought a drawing by Emma, his granddaughter.':name==='album2'?'Alex looked through the family album with Sam.':a.text;
   const text='FICTIONAL SIMULATION: '+description;
   const created=await team.ingest({id:eventId,patient_id:r.patient,start:r.clock.toISOString(),place:name.startsWith('caregiver_')?careRoom:a.room,what:a.label,gist:text,status:'auto',evidence:{text,source_type:'caregiver_report'}});
   if(created.created)await team.review({patient_id:r.patient,id:eventId,status:'carer_verified'});
   const log=await life.addLog({patient_id:r.patient,id:eventId+'_log',activity:a.activity,label:a.label,outcome:name==='lost'?'uncertain':'reported_done',occurred_at:r.clock.toISOString(),source_type:'caregiver_report',original_text:text},true);
   if(log.created)await this.store.update('daily_logs',{...r.service.scope(r.patient),_id:log.record._id},{simulationOrder:++r.sequence,simulationAction:name});
   if(log.created)await life.review({patient_id:r.patient,collection:'daily_logs',id:eventId+'_log',status:'approved'});
   if(name.startsWith('color_')){const preference=await life.addPersonal({patient_id:r.patient,id:eventId+'_preference',kind:'preference',title:'Favourite colour',original_text:description,source_type:'user_report'},true);if(preference.created)await this.store.update('personal_records',{...r.service.scope(r.patient),_id:preference.record._id},{simulationOrder:r.sequence});if(preference.created)await life.review({patient_id:r.patient,collection:'personal_records',id:preference.record.recordId,status:'approved'});}
   if(paid)this.spend(r,key);
   await r.service.tick();r.done.add(name);r.done.add(key);
   r.history.push({question:'[Chosen activity] '+a.label,answer:description,mode:'Saved simulation activity',at:r.clock.toISOString(),citations:[log.record._id]});r.history=r.history.slice(-40);
   return {...await this.state(r),event:{label:a.label,text:description,at:r.clock},simulatedContact:name==='contact'};
  }finally{r.busy=false;}
 }
 private async advanceClock(r:Run,minutes:number){
  const end=+r.clock+minutes*60000;
  const limit=+dayBounds(shiftDay(r.day,1),this.cfg.timezone).end-60000;
  if(end>limit)throw Object.assign(Error('This sandbox covers two days. Restart to begin a new stay.'),{status:400});
  // Reconcile at every due time crossed, without a database call for each minute.
  const plans=await this.store.list('plans',r.service.scope(r.patient),{},100);
  const milestones=[...new Set<number>(plans.map((p:any)=>+new Date(p.dueAt)).filter((t:number)=>t>+r.clock&&t<=end))].sort((a,b)=>a-b);
  for(const t of [...milestones,end]){r.clock=new Date(t);await r.service.tick();}
 }
 async advance(id:string,minutes:number){
  const r=this.get(id);
  if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw Object.assign(Error('Choose between 1 and 1440 minutes.'),{status:400});
  if(r.busy)throw Object.assign(Error('Wait for the current action to finish.'),{status:409});
  r.busy=true;try{await this.advanceClock(r,minutes);return await this.state(r);}finally{r.busy=false;}
 }
 async converse(id:string,text:string,requestId:string){
  const r=this.get(id);
  if(typeof text!=='string'||!text.trim()||text.length>600||typeof requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(requestId))throw Object.assign(Error('Enter a message of up to 600 characters.'),{status:400});
  if(r.busy)throw Object.assign(Error('Wait for the current turn.'),{status:409});
  r.busy=true;
  try{
   this.checkBudget(r,requestId);
   const agent=new ConversationAgent(r.service,this.classifier);
   const turn=await agent.turn(r.patient,{transcript:text,turn_id:requestId,session_id:r.id});
   const saved=await agent.commit(r.patient,{id:turn._id});
   let result:any={answer:saved.acknowledgement,mode:'Main conversation pipeline · isolated demo',citations:[],recordsRead:0};
   if(['question','mixed'].includes(saved.intent))result=await this.answer(id,saved.recallQuery||saved.question||text);
   else {r.history.push({question:text,answer:result.answer,mode:result.mode,at:r.clock.toISOString(),citations:[]});r.history=r.history.slice(-40);}
   await agent.answer(r.patient,turn._id,result);this.spend(r,requestId);
   return {...result,intent:saved.intent,outputs:saved.outputs||[],state:await this.state(r)};
  }finally{r.busy=false;}
 }
 async ask(id:string,question:string,useModel=true){
  const r=this.get(id);if(r.busy)throw Object.assign(Error('Wait for the current action to finish.'),{status:409});
  r.busy=true;try{const free=/\b(sos|lost|help me)\b/i.test(question);if(!free)this.checkBudget(r);const result=await this.answer(id,question,useModel);if(!free)this.spend(r,randomUUID());return {...result,state:await this.state(r)};}finally{r.busy=false;}
 }
 private async answer(id:string,question:string,useModel=true){
  if(typeof question!=='string'||!question.trim()||question.length>600)throw Object.assign(Error('Ask a question of up to 600 characters.'),{status:400});
  const r=this.get(id),scope=r.service.scope(r.patient);
  const allRecords=await this.store.list('daily_logs',scope,{occurredAt:1,simulationOrder:1},1001),personal=await this.store.list('personal_records',scope,{recordedAt:1,simulationOrder:1},1001),allPlans=await this.store.list('plans',scope,{},10);
  const prior=r.history.slice(-6),last=prior.at(-1);
  let contextualQuestion=question;
  const followup=/\b(she|her|he|him|they|them)\b|^(?:tell me more|what else|and (?:yesterday|today)|what about yesterday)[?.! ]*$/i.test(question.trim());
  if(followup){
   // Resolve only the most recently named person; never pick a random family card.
   const reference=[...prior].reverse().find((h:any)=>/Sarah|David|Sam/.test(h.question+' '+h.answer));
   const names=reference?[...new Set((reference.question+' '+reference.answer).match(/Sarah|David|Sam/g)||[])]:[];
   if(names.length===1)contextualQuestion=question+' (About '+names[0]+')';
  }
  const q=contextualQuestion.toLowerCase(),currentDay=localDayKey(r.clock,this.cfg.timezone);
  const both=/both days|two days|whole stay/.test(q),explicit=/yesterday|previous day|day one|day 1|first day|today|day two|day 2|second day/.test(q);
  const targetDay=/yesterday|previous day/.test(q)?shiftDay(currentDay,-1):/day one|day 1|first day/.test(q)?r.day:/day two|day 2|second day/.test(q)?shiftDay(r.day,1):currentDay;
  const records=allRecords.filter((x:any)=>both||localDayKey(x.occurredAt,this.cfg.timezone)===targetDay);
  const plans=allPlans.filter((x:any)=>both||localDayKey(x.eventStart,this.cfg.timezone)===targetDay);
  const glasses=/glasses|spectacles/.test(q),visitors=/visit|who came|who did i see/.test(q)&&!/scheduled|planned|coming|going to/.test(q);
  let selected=glasses?(explicit?records:allRecords).filter((x:any)=>/^Glasses on/.test(x.label)).slice(-1):visitors?records.filter((x:any)=>['Sarah visits','David visits','Sarah returns'].includes(x.label)):/breakfast/.test(q)?records.filter((x:any)=>/breakfast/i.test(x.label)):/eat|food|lunch|dinner/.test(q)?records.filter((x:any)=>x.activity==='meal'):/colou?r/.test(q)?personal.filter((x:any)=>x.title==='Favourite colour').slice(-1):/david|physiotherapist/.test(q)?personal.filter((x:any)=>x.title==='David Lee'):/\bsam\b|caregiver/.test(q)?personal.filter((x:any)=>x.title==='Sam Rivera'):/daughter|sarah/.test(q)?personal.filter((x:any)=>x.title==='Sarah Mercer'):/my name|who i am/.test(q)?personal.filter((x:any)=>x.title==='Identity'):/garden|rosemary/.test(q)?records.filter((x:any)=>/garden|rosemary/i.test(x.originalText)):/summary|summari|today|day|happen/.test(q)?records:[];
  if(!selected.length&&/^(?:what did we do|what did i just do|what happened then|tell me about that)[?.! ]*$/i.test(question.trim())){
   const activity=[...prior].reverse().find((h:any)=>h.mode==='Saved simulation activity');
   if(activity)selected=allRecords.filter((x:any)=>activity.citations?.includes(x._id));
  }
  const eventEvidence=[...new Map([...records,...selected.filter((x:any)=>x.occurredAt)].map((x:any)=>[x._id,x])).values()] as any[];
  const evidence=[...personal.map((x:any)=>({id:x._id,text:x.originalText+(x.title==='Sarah Mercer'?' The simulation can display a saved fictional illustration labelled Sarah Mercer. It is not a real photograph.':'' )})),...(glasses?selected:eventEvidence).map((x:any)=>({id:x._id,text:x.originalText,at:x.occurredAt})),...plans.map((x:any)=>({id:x._id,text:x.kind==='photo_album'?'Planned photo-album activity; not a completed event.':`Planned visit from ${x.personId===r.patient+'_sarah'?'Sarah Mercer':'David Lee'}; not evidence of a completed visit.`,at:x.eventStart}))];
  let answer='',mode='database fallback',citations:string[]=[];
  if(selected.length){answer='Here is what our notes say'+(both?' about both days':explicit?' for '+targetDay:'')+': '+selected.map((x:any)=>(x.originalText||'').replace(/^FICTIONAL SIMULATION:\s*/, '')).join(' ');citations=selected.map((x:any)=>x._id);}
  else answer="I don’t have a note about that for "+targetDay+" yet. Would you like to tell me what you remember, or try another activity together?";
  if(selected.length&&glasses){const last=selected.at(-1);answer=(last.originalText as string).replace(/^FICTIONAL SIMULATION:\s*/, '').replace('Alex left his','You left your').replace('Alex moved his','You moved your')+' That was recorded at '+new Intl.DateTimeFormat('en-GB',{timeZone:this.cfg.timezone,dateStyle:'medium',timeStyle:'short'}).format(last.occurredAt)+'.';}
  if(selected.length&&!glasses&&!selected.some((x:any)=>x.title)){
   const natural=(x:any)=>(x.originalText||'').replace(/^FICTIONAL SIMULATION:\s*/, '').replace(/Alex’s|Alex's/g,'your').replace(/\bAlex\b/g,'you').replace('his granddaughter','your granddaughter').replace('his glasses','your glasses');
   answer=(both?'Across these two days, our notes say: ':explicit&&targetDay!==currentDay?'For '+targetDay+', our notes say: ':'Here’s what I remember from your notes: ')+selected.map(natural).join(' ');
  }
  if(selected.some((x:any)=>x.title==='David Lee'))answer='David Lee is your physiotherapist. I can help you recall his recorded visits.';
  if(selected.some((x:any)=>x.title==='Sam Rivera'))answer='Sam Rivera is your caregiver. I can help you recall activities you have done together.';
  if(selected.some((x:any)=>x.title==='Sarah Mercer'))answer='Sarah Mercer is your daughter. Here is her saved illustration to help you remember her.';
  if(/scheduled|planned|coming|who is.*visit/.test(q)&&plans.length){answer='The saved plans for '+targetDay+' are: '+plans.map((p:any)=>(p.kind==='photo_album'?'photo-album time':p.personId===r.patient+'_sarah'?'Sarah’s visit':'David’s visit')+' at '+new Intl.DateTimeFormat('en-GB',{timeZone:this.cfg.timezone,hour:'2-digit',minute:'2-digit'}).format(p.eventStart)).join('; ')+'. These are plans, not confirmation that they happened.';citations=plans.map((p:any)=>p._id);}
  const social=/^(?:hi|hello|thanks|thank you|okay|ok|it[’']?s (?:lovely|nice) to see you(?:,? Sarah)?)[.! ]*$/i.test(question.trim());
  if(social){answer=/thanks|thank you/i.test(question)?'You’re welcome. What would you like to do next?':'I’m here with you. We can talk about what you just did, look at a memory, or choose something else together.';mode='conversational response';citations=[];}
  else if(/\blost\b|help me/.test(q)){answer="Let's get you some support. Would you like to simulate contacting Sam, your caregiver? No real message will be sent.";mode='simulation safety response';}
  else if(useModel&&companionSettings().configured){
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),24000);
   try{
    const ai=await companionClient({signal:abort.signal});
    const result:any=await ai.interactions.create({model:companionSettings().model,store:false,system_instruction:MUSE_PERSONALITY+' You are in an explicitly fictional 2D simulation. Answer only from the supplied database evidence. All locations and activities are simulated. Never claim real calls or real GPS. Previous conversation is context, not evidence. No medication advice. Reply as JSON {answer: string, citations: string[]} with exact source IDs. If unsupported, say what is missing. Be brief and natural.',input:JSON.stringify({question,contextualQuestion,simulationTime:r.clock,requestedDay:both?'both days':targetDay,timezone:this.cfg.timezone,evidence,history:r.history.slice(-4)}),generation_config:{thinking_level:'low',max_output_tokens:600},response_format:{type:'text',mime_type:'application/json',schema:{type:'object',required:['answer','citations'],properties:{answer:{type:'string'},citations:{type:'array',items:{type:'string'}}}}}});
    const candidate=JSON.parse(result.output_text||'{}');
    if(typeof candidate.answer==='string'&&candidate.answer.length<=1800&&Array.isArray(candidate.citations)&&candidate.citations.length&&candidate.citations.every((c:any)=>evidence.some(e=>e.id===c))&&!/\b(?:no|do not have|don't have)\b[^.]{0,45}\b(?:photo|picture|image|illustration)\b/i.test(candidate.answer)&&await verifyConversation(ai,companionSettings().model,question,candidate.answer,JSON.stringify({identity:'The fictional patient is Alex Mercer. You and your refer to Alex.',records:evidence.filter(e=>candidate.citations.includes(e.id))}))){answer=candidate.answer;citations=candidate.citations;mode=companionSettings().provider+' · checked against records';}
   }catch{}finally{clearTimeout(timer);}
  }
  r.history.push({question,answer,mode,at:r.clock.toISOString(),citations});r.history=r.history.slice(-40);
  const picture=/daughter|sarah|photo|picture/.test(q)&&citations.some(c=>personal.some((p:any)=>p._id===c&&p.title==='Sarah Mercer'));
  return {answer,mode,citations,recordsRead:evidence.length,requestedDay:both?'both days':targetDay,picture:picture?'/simulation/sarah.png':null,simulation:true};
 }
 async remove(id:string){const r=this.runs.get(id);if(!r)return;if(r.busy)throw Object.assign(Error('Wait for the action to finish before resetting.'),{status:409});const scope=r.service.scope(r.patient);if(scope.householdId!=='engram-simulation'||!scope.subjectId.startsWith('sim_'))throw Error('Unsafe simulation scope');for(const name of TABLES){if(this.store.db)await this.store.db.collection(name).deleteMany(scope);else for(const[k,v]of this.store.table(name))if((v as any).householdId===scope.householdId&&(v as any).subjectId===scope.subjectId)this.store.table(name).delete(k);}this.runs.delete(id);}
}
export function isolatedSimulationConfig(main:any){
 const database='engram_alex_simulation';
 if(String(main.database).toLowerCase()===database)throw Error('Main database must not use the reserved Alex simulation database.');
 return {...main,database,householdId:'engram-simulation',subjectIds:[],contextProcessing:'local'};
}
export async function mountSimulation(app:Express){
 const publicOrigin=publicSimulationOrigin();
 const cfg=isolatedSimulationConfig(config()),store=await createStore(cfg),engine=new SimulationEngine(store,cfg),limits=new RequestLimits();
 app.use('/api/simulation',async(req,res)=>{
  try{
   if(!publicOrigin&&!localDemoAccess(req,'demo-person-001'))return void res.status(403).json({error:'This deployment has not enabled public simulation access.'});
   if(req.headers.origin&&req.headers.origin!==(publicOrigin||`${req.protocol}://${req.get('host')}`))return void res.status(403).json({error:'Use the same-origin demo page.'});
   limits.take('simulation:'+req.ip,90);if(req.method!=='POST')return void res.status(405).json({error:'POST required'});
   if(req.path==='/start'){limits.take('simulation-start:'+req.ip,8);return void res.json(await engine.start());}
   const id=String(req.get('X-Simulation-Run')||'');engine.get(id);
   if(req.path==='/state')return void res.json(await engine.state(engine.get(id)));
   if(req.path==='/action')return void res.json(await engine.action(id,req.body?.action,{sandbox:req.body?.sandbox===true,requestId:req.body?.requestId,room:req.body?.room}));
   if(req.path==='/advance')return void res.json(await engine.advance(id,req.body?.minutes));
   if(req.path==='/converse'){limits.take('simulation-model:'+req.ip,12);return void res.json(await engine.converse(id,req.body?.text,req.body?.requestId));}
   if(req.path==='/ask'){limits.take('simulation-model:'+req.ip,12);return void res.json(await engine.ask(id,req.body?.question));}
   if(req.path==='/reset'){await engine.remove(id);return void res.json({removed:true});}
   res.status(404).json({error:'Unknown simulation route'});
  }catch(e:any){res.status(e.status||500).json({error:e.status?e.message:'Simulation storage is unavailable. Check the local server and Atlas connection.'});}
 });
 return {close:()=>store.close()};
}
