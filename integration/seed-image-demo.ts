import 'dotenv/config';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {config} from '../engram-retrieval/src/config.js';import {createStore} from '../engram-retrieval/src/store.js';import {EngramService} from '../engram-retrieval/src/service.js';import {ImageMemory} from './image-memory';import {localDayKey,shiftDay} from '../engram-retrieval/src/memory-model.js';
const cfg=config(),patient=process.env.ANCHORCARE_PATIENT_ID||cfg.subjectIds[0];if(cfg.mode!=='mongodb'||patient!=='demo-person-001')throw Error('Image seed is restricted to the fictional demo patient');
const store=await createStore(cfg),service=new EngramService(store,cfg),images=new ImageMemory(service),scope=service.scope(patient);
const namespace=createHash('sha256').update(`${cfg.householdId}:${patient}`).digest('hex').slice(0,10);const day=shiftDay(localDayKey(new Date(),cfg.timezone),-1).replaceAll('-','');
const samples=[{file:'sarah-demo.png',target_type:'person',target_id:`demo_${namespace}_sarah`,caption:'FICTIONAL DEMO: Sarah Mercer illustration placeholder, not an actual photograph.'},
 {file:'garden-demo.png',target_type:'episode',target_id:`alex_demo_${namespace}_${day}_walk`,caption:'FICTIONAL DEMO: courtyard garden walk illustration, not an actual event photograph.'}];
try{const result=[];for(const sample of samples){
 const old=await store.one('memory_images',{...scope,targetType:sample.target_type,targetId:sample.target_id,caption:sample.caption});
 if(old){result.push({id:old._id,status:old.reviewStatus,preserved:true});continue;}
 const upload=await images.upload(patient,{...sample,content_type:'image/png',image_base64:readFileSync(new URL('../fixtures/images/'+sample.file,import.meta.url)).toString('base64')});
 await images.review(patient,{image_id:upload.image._id,status:'approved'});result.push({id:upload.image._id,status:'approved',preserved:false});
}console.log(JSON.stringify({passed:true,fictional:true,storage:'MongoDB GridFS',images:result}));}catch(e:any){console.error(JSON.stringify({passed:false,errorType:e.name,action:'Ensure the fictional person cards and garden-walk memory have been seeded and approved.'}));process.exitCode=1;}finally{await store.close();}
