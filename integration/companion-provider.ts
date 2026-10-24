import {managedGemini} from './gemini-manager';
export function companionSettings(){
 const provider=process.env.COMPANION_PROVIDER||'gemini';
 if(!['gemini','openrouter','ollama'].includes(provider))throw Error('Unsupported companion provider');
 const model=provider==='gemini'?(process.env.GEMINI_COMPANION_MODEL||process.env.GEMINI_MODEL||'gemini-4-argon'):provider==='openrouter'?(process.env.OPENROUTER_MODEL||'openrouter/free'):(process.env.OLLAMA_MODEL||'qwen3:4b');
 if(provider==='openrouter'&&model!=='openrouter/free'&&!model.endsWith(':free'))throw Error('Only free OpenRouter models are enabled for this demo');
 return {provider,model,configured:provider==='ollama'||Boolean(provider==='gemini'?(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY):process.env.OPENROUTER_API_KEY)};
}
// Translate the existing structured inference contract; never expose database tools or execute model actions.
export function compatibleClient(provider:'openrouter'|'ollama',transport:typeof fetch=fetch){
 return {interactions:{create:async(params:any,options:any)=>{
  const schema=params.response_format?.schema;
  const messages=[{role:'system',content:(params.system_instruction||'Reply helpfully.')+(schema?'\nReturn only JSON matching this schema: '+JSON.stringify(schema):'')},{role:'user',content:params.input}];
  let url:string,headers:Record<string,string>={'Content-Type':'application/json'},body:any;
  if(provider==='openrouter'){
   if(params.model!=='openrouter/free'&&!params.model.endsWith(':free'))throw Error('Paid model route blocked');
   url='https://openrouter.ai/api/v1/chat/completions';headers.Authorization='Bearer '+process.env.OPENROUTER_API_KEY;
   body={model:params.model,messages,max_tokens:params.generation_config?.max_output_tokens||900,provider:{data_collection:'deny'},...(schema?{response_format:{type:'json_schema',json_schema:{name:'companion_reply',strict:false,schema}}}:{})};
  }else{
   const base=new URL(process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434');
   if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||!['http:','https:'].includes(base.protocol))throw Error('Ollama must run on loopback');
   url=new URL('/api/chat',base).href;body={model:params.model,messages,stream:false,think:false,...(schema?{format:schema}:{}),options:{num_predict:params.generation_config?.max_output_tokens||900}};
  }
  const response=await transport(url,{method:'POST',headers,body:JSON.stringify(body),signal:options.signal});
  if(!response.ok)throw Object.assign(Error(provider+' request failed (HTTP '+response.status+')'),{status:response.status});
  const data=await response.json();const content=provider==='openrouter'?data.choices?.[0]?.message?.content:data.message?.content;
  if(typeof content!=='string'||!content.trim())throw Error('Model returned no usable text');
  return {output_text:content,model:data.model,status:'completed'};
 }}};
}
export async function companionClient(options:{signal?:AbortSignal;onProgress?:(phase:string)=>void}={}){
 const settings=companionSettings();if(!settings.configured)throw Error('Companion provider needs configuration');
 let raw:any;
 if(settings.provider==='gemini'){const{GoogleGenAI}=await import('@google/genai');raw=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY});}
 else raw=compatibleClient(settings.provider as 'openrouter'|'ollama');
 return {...managedGemini(raw,options),provider:settings.provider};
}
