import {createHash,randomUUID} from 'node:crypto';
import {ApiError,id,text,date,choice} from '../engram-retrieval/src/validation.js';
const hash=(...parts:any[])=>createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export class MedicationReminders {
 constructor(private service:any){}
 async create(patient:string,input:any){
  const scope=this.service.scope(patient),now=this.service.clock();
  const due=date(input.scheduled_at,'scheduled_at');
  if(due<=now || +due-+now>366*86400000)throw new ApiError(400,'Choose a future time within one year');
  const record={_id:input.id?id(input.id):'med_'+randomUUID(),...scope,kind:'medication',triggerType:'time',
   label:text(input.label,'label',120),carePlanRef:text(input.care_plan_ref,'care_plan_ref',200),
   eventStart:due,dueAt:due,expiresAt:new Date(+due+10*60000),personId:null,placeId:null,
   reviewStatus:'draft',eventStatus:'planned',version:1,createdAt:now};
  if(!await this.service.store.insert('plans',record))throw new ApiError(409,'Plan ID already exists');
  await this.service.audit(scope,'medication_plan_drafted',record._id);
  return {plan:record};
 }
 async approve(patient:string,input:any){
  if(input.status!=='carer_verified')throw new ApiError(400,'Explicit caregiver approval required');
  const scope=this.service.scope(patient),store=this.service.store;
  const plan=await store.one('plans',{...scope,_id:id(input.plan_id),kind:'medication'});
  if(!plan||plan.reviewStatus!=='draft'||plan.eventStatus!=='planned'||plan.dueAt<=this.service.clock())throw new ApiError(409,'Plan is not an approvable future draft');
  const result=await store.update('plans',{...scope,_id:plan._id,version:plan.version,reviewStatus:'draft'},
   {reviewStatus:'approved',version:plan.version+1,approvedAt:this.service.clock()});
  if(!result)throw new ApiError(409,'Plan changed');
  await this.service.audit(scope,'medication_plan_approved',plan._id);
  return {plan:result};
 }
 async respond(patient:string,input:any){
  const scope=this.service.scope(patient),store=this.service.store,now=this.service.clock();
  const promptId=text(input.prompt_id,'prompt_id',250),action=choice(input.action,['taken','not_taken','unsure'],'action');
  const responseId=hash(scope,promptId),saved=await store.one('medication_responses',{...scope,_id:responseId});
  if(saved){if(saved.action!==action)throw new ApiError(409,'A different response is already saved; ask your caregiver to review it');return {response:saved,duplicate:true};}
  const prompt=await store.one('prompts',{...scope,_id:promptId});
  if(!prompt||prompt.kind!=='medication'||prompt.status!=='pending'||prompt.expiresAt<=now||prompt.availableAt>now)throw new ApiError(409,'Medication reminder is no longer actionable');
  const plan=await store.one('plans',{...scope,_id:prompt.planId,kind:'medication'});
  if(!plan||plan.reviewStatus!=='approved'||plan.eventStatus!=='planned'||plan.version!==prompt.planVersion)throw new ApiError(409,'Medication plan changed');
  const recordId='med_report_'+responseId;
  const outcome=({taken:'reported_done',not_taken:'reported_not_done',unsure:'uncertain'} as Record<string,string>)[action];
  const content={activity:'medication',label:plan.label,outcome,occurredAt:now,sourceType:'user_report',
   originalText:`Patient reported ${action==='taken'?'having taken medication':action==='not_taken'?'not having taken medication':'being unsure whether medication was taken'} in response to a care-plan reminder. This is a self-report; ingestion and dose are not verified.`,sourceRef:promptId};
  const log={_id:hash('daily_logs',scope,recordId),...scope,recordId,...content,digest:hash(content),reviewStatus:'draft',recordedAt:now};
  const response={_id:responseId,...scope,promptId,planId:plan._id,action,outcome,sourceType:'user_report',occurredAt:now,dailyLogId:log._id,dailyLogRecordId:recordId,caregiverReviewed:false};
  const changes={status:'medication_reported',lastResponse:action,respondedAt:now};
  if(store.mode==='mongodb'){
   const session=store.client.startSession();
   try{await session.withTransaction(async()=>{
    // Read plan in the transaction too; cancellation/approval withdrawal must not race reporting.
    const current=await store.db.collection('plans').findOne({...scope,_id:plan._id,version:plan.version,reviewStatus:'approved',eventStatus:'planned'},{session});
    if(!current)throw new ApiError(409,'Medication plan changed');
    // Writing the plan serializes this transaction with cancellation and other reports.
    const locked=await store.db.collection('plans').updateOne({...scope,_id:plan._id,version:plan.version,reviewStatus:'approved',eventStatus:'planned'},{$set:{lastPatientReportAt:now}},{session});
    if(locked.matchedCount!==1)throw new ApiError(409,'Medication plan changed');
    const changed=await store.db.collection('prompts').updateOne({...scope,_id:promptId,status:'pending',availableAt:prompt.availableAt},{$set:changes},{session});
    if(changed.matchedCount!==1)throw new ApiError(409,'Reminder changed');
    await store.db.collection('daily_logs').insertOne(log,{session});
    await store.db.collection('medication_responses').insertOne(response,{session});
    await store.db.collection('audit_events').insertOne({_id:'audit_'+randomUUID(),...scope,action:'medication_self_report',recordId:responseId,at:now,detail:{action}},{session});
   });}finally{await session.endSession();}
  }else{
   const changed=await store.update('prompts',{...scope,_id:promptId,status:'pending',availableAt:prompt.availableAt},changes);
   if(!changed)throw new ApiError(409,'Reminder changed');
   await store.insert('daily_logs',log);await store.insert('medication_responses',response);
  }
  return {response,duplicate:false,message:'Your response was saved for caregiver review. It does not confirm ingestion.'};
 }
 async review(patient:string){
  const scope=this.service.scope(patient),store=this.service.store,now=this.service.clock();
  const plans=await store.list('plans',{...scope,kind:'medication'},{createdAt:-1},100);
  const records=await Promise.all(plans.map(async(plan:any)=>{
   const response=await store.one('medication_responses',{...scope,planId:plan._id});
   const expired=plan.reviewStatus==='approved'&&plan.eventStatus==='planned'&&plan.expiresAt<=now&&!response;
   return {plan,response,responseState:response?response.action:expired?'unanswered':'pending',reviewRequired:expired||Boolean(response&&!response.caregiverReviewed),
    interpretation:expired?'No response recorded; this does not prove medication was missed.':'Patient report only; ingestion is not verified.'};
  }));
  return {records,limit:100};
 }
 async acknowledge(patient:string,input:any){
  const scope=this.service.scope(patient);
  const result=await this.service.store.update('medication_responses',{...scope,_id:text(input.response_id,'response_id',100)},
   {caregiverReviewed:true,caregiverReviewedAt:this.service.clock(),caregiverNote:text(input.note,'note',1000)});
  if(!result)throw new ApiError(404,'Response not found');
  await this.service.audit(scope,'medication_response_reviewed',result._id);
  return {response:result};
 }
}
