import {readFileSync} from 'node:fs';
import 'dotenv/config';
import {createHash} from 'node:crypto';
import {config} from '../engram-retrieval/src/config.js';
import {createStore} from '../engram-retrieval/src/store.js';
import {EngramService} from '../engram-retrieval/src/service.js';
import {MedicationReminders} from './medication';
import {localDayKey} from '../engram-retrieval/src/memory-model.js';
const cfg=config(),patient=process.env.ANCHORCARE_PATIENT_ID||cfg.subjectIds[0];
if(cfg.mode!=='mongodb'||patient!=='demo-person-001')throw Error('This fictional seed is restricted to demo-person-001 on MongoDB');
const store=await createStore(cfg),scope={householdId:cfg.householdId,subjectId:patient};
const scenarioId='med_demo_'+createHash('sha256').update(JSON.stringify([scope,localDayKey(new Date(),cfg.timezone)])).digest('hex').slice(0,16);
const manifest=await store.one('demo_scenarios',{...scope,_id:scenarioId});const base=manifest?.baseTime?new Date(manifest.baseTime):new Date();
if(!manifest)await store.insert('demo_scenarios',{_id:scenarioId,...scope,baseTime:base,fictional:true,type:'medication'});
const fixture=JSON.parse(readFileSync(new URL('../fixtures/medication-simulation.json',import.meta.url),'utf8'));
const scenarios: Array<{key:string;offset:number;response?:string}>=fixture.scenarios;
try{
 for(const item of scenarios){const planId=scenarioId+'_'+item.key;if(await store.one('plans',{...scope,_id:planId}))continue;
  const due=new Date(+base+item.offset);let clock=new Date(+due-60000);
  const service=new EngramService(store,{...cfg,subjectIds:[patient],quietStart:'00:00',quietEnd:'00:00',cooldownSeconds:0},()=>new Date(clock));const med=new MedicationReminders(service);
  await med.create(patient,{id:planId,label:'FICTIONAL DEMO - '+item.key+' medication-plan check',care_plan_ref:'FICTIONAL-CARE-PLAN-001',scheduled_at:due.toISOString()});
  if(item.key!=='draft')await med.approve(patient,{plan_id:planId,status:'carer_verified'});
  if(item.offset<0){clock=due;await service.tick();if(item.response){const prompt=(await service.prompts(patient)).find((p:any)=>p.planId===planId);if(!prompt)throw Error('Historical demo prompt not generated');await med.respond(patient,{prompt_id:prompt._id,action:item.response});}}
 }
 console.log(JSON.stringify({passed:true,scenarioId,fictional:true,scenarios:scenarios.map(s=>s.key),upcomingAt:new Date(+base+60000).toISOString(),timezone:cfg.timezone,repeatPreservesExisting:true}));
}catch(e:any){console.error(JSON.stringify({passed:false,errorType:e.name}));process.exitCode=1;}finally{await store.close();}
