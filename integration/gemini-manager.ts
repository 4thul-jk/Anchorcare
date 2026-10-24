import {checkModelCircuit,recordModelCall} from './gemini-diagnostics';
export function retryableGeminiError(error:any):boolean{
 const status=Number(error?.status||error?.statusCode||error?.response?.status);
 const message=String(error?.message||'');
 if(/monthly spending cap|daily quota|insufficient.quota|prepay|billing|credits.depleted|quota.exceeded/i.test(message))return false;
 if(status)return [408,429,500,502,503,504].includes(status);
 return ['TimeoutError','RequestTimeoutError','GeminiAttemptTimeout','NetworkError'].includes(error?.name)||['ECONNRESET','ETIMEDOUT','ECONNREFUSED','EAI_AGAIN'].includes(error?.cause?.code||error?.code);
}
function abortError(){return new DOMException('Request cancelled','AbortError');}
export function abortableDelay(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{
 if(signal?.aborted)return reject(abortError());
 const abort=()=>{clearTimeout(timer);reject(abortError());};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 signal?.addEventListener('abort',abort,{once:true});
});}
export async function requestWithRetry<T>(operation:(signal:AbortSignal)=>Promise<T>,options:{signal?:AbortSignal;attemptMs?:number;maxRetries?:number;baseDelayMs?:number;onProgress?:(phase:string)=>void}={}){
 const {signal,attemptMs=15000,maxRetries=2,baseDelayMs=600}=options;
 for(let attempt=0;;attempt++){
  if(signal?.aborted)throw abortError();
  let retryAfterMs=0;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  options.onProgress?.(attempt?'retrying':'checking');
  try{
   const deadline=new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>{controller.abort();const e=new Error('Gemini attempt timed out');e.name='GeminiAttemptTimeout';reject(e);},attemptMs);
    controller.signal.addEventListener('abort',()=>{if(signal?.aborted)reject(abortError());},{once:true});
   });
   return await Promise.race([operation(controller.signal),deadline]);
  }catch(error:any){
   if(signal?.aborted)throw abortError();
   // If the provider reports abort before the timer rejection wins, classify that local timeout.
   const transient=controller.signal.aborted&&!signal?.aborted||retryableGeminiError(error);
   if(!transient||attempt>=maxRetries)throw error;
   const header=error?.response?.headers?.get?.('retry-after')||error?.headers?.get?.('retry-after');
   if(header){const seconds=Number(header);const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(header)-Date.now();if(Number.isFinite(delay)&&delay>0)retryAfterMs=Math.min(delay,86400000);}
  }finally{if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  options.onProgress?.('retrying');
  await abortableDelay(Math.max(retryAfterMs,baseDelayMs*2**attempt)+Math.floor(Math.random()*Math.max(1,baseDelayMs/2)),signal);
 }
}
export function managedGemini(ai:any,options:{signal?:AbortSignal;onProgress?:(phase:string)=>void}={}){
 return {managed:true,interactions:{create:async(params:any,callOptions:any={})=>{
  const model=String(params.model||'unspecified');checkModelCircuit(model);const start=Date.now();
  try{const result=await requestWithRetry(signal=>ai.interactions.create(params,{signal,retries:{strategy:'none'}}),{...options,attemptMs:params.model==='gemini-4-argon'?Math.max(callOptions.attemptMs||15000,(callOptions.attemptMs||15000)<=6000?25000:40000):(callOptions.attemptMs||15000),maxRetries:callOptions.maxRetries??(params.model==='gemini-4-argon'?0:1)});recordModelCall(model,start,result);return result;}
  catch(error){recordModelCall(model,start,undefined,error);throw error;}
 }}};
}
export function callGemini(ai:any,params:any,attemptMs:number){
 return (ai.managed?ai:managedGemini(ai)).interactions.create(params,{attemptMs});
}
