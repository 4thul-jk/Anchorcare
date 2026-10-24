import {createHash} from 'node:crypto';
import type {Express} from 'express';
import {ApiError} from '../engram-retrieval/src/validation.js';

// Bounded process-local limits: use a shared gateway limiter before multi-instance deployment.
export class RequestLimits{
 private windows=new Map<string,{until:number;count:number}>();
 constructor(private now=()=>Date.now()){}
 take(key:string,limit:number,windowMs=60000){
  const now=this.now();for(const[k,v]of this.windows)if(v.until<=now)this.windows.delete(k);
  const current=this.windows.get(key)||{until:now+windowMs,count:0};
  if(!this.windows.has(key)&&this.windows.size>=5000)throw new ApiError(429,'Server busy; retry shortly');
  if(++current.count>limit)throw new ApiError(429,'Too many requests; retry shortly');
  this.windows.set(key,current);
 }
}
export function credentialBucket(value:string){return createHash('sha256').update(value).digest('hex');}
export function validateRequestObject(value:any,depth=0,budget={keys:0}){
 if(depth===0&&(!value||typeof value!=='object'||Array.isArray(value)))throw new ApiError(400,'Expected a JSON object');
 if(depth>12)throw new ApiError(400,'Request nesting is too deep');
 if(!value||typeof value!=='object')return;
 for(const[key,item]of Object.entries(value)){
  if(++budget.keys>2000)throw new ApiError(400,'Too many request fields');
  if(key.startsWith('$')||['__proto__','prototype','constructor'].includes(key))throw new ApiError(400,'Unsupported request field');
  validateRequestObject(item,depth+1,budget);
 }
}
export function installHttpSecurity(app:Express){
 app.disable('x-powered-by');
 app.use((_req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  next();
 });
 app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
}
