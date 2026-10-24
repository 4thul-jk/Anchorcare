type Entry={requestedModel:string;returnedModel?:string;elapsedMs:number;outcome:string;httpStatus?:number;at:string};
const recent:Entry[]=[];
const blocked=new Map<string,{until:number;reason:string}>();
export function providerReason(error:any){
 const status=Number(error?.status||error?.statusCode||error?.response?.status)||undefined;
 const message=String(error?.message||'');
 const reason=/monthly spending cap|billing|credits.depleted|prepay|insufficient.quota/i.test(message)?'billing_limit':/daily quota|quota.exceeded/i.test(message)?'quota_limit':status===401||status===403?'access_denied':status===404?'model_unavailable':error?.name==='AbortError'?'cancelled':/timeout|timed out/i.test(message)||/Timeout/.test(error?.name||'')?'timeout':status===429?'rate_limited':'provider_error';
 return {reason,status};
}
export function checkModelCircuit(model:string){const item=blocked.get(model);if(item&&item.until>Date.now())throw Object.assign(Error('Gemini '+item.reason),{name:'GeminiProviderUnavailable',providerReason:item.reason,status:503});blocked.delete(model);}
export function recordModelCall(model:string,start:number,response?:any,error?:any){
 const failure=error?providerReason(error):null;
 const entry:Entry={requestedModel:model,returnedModel:typeof response?.model==='string'?response.model:undefined,elapsedMs:Date.now()-start,outcome:failure?.reason||'response_received',httpStatus:failure?.status,at:new Date().toISOString()};
 recent.push(entry);if(recent.length>50)recent.shift();
 if(failure&&['billing_limit','quota_limit','access_denied','model_unavailable'].includes(failure.reason))blocked.set(model,{until:Date.now()+5*60000,reason:failure.reason});
}
export function modelDiagnostics(model:string){const item=blocked.get(model);return {requestedModel:model,providerStatus:item&&item.until>Date.now()?item.reason:'not_blocked',retryAfter:item&&item.until>Date.now()?new Date(item.until).toISOString():null,recent:recent.slice(-20),note:'Requested model is configuration; returnedModel is shown only when supplied by the provider. No prompts or keys are logged.'};}
