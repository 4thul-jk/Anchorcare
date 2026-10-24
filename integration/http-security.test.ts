import test from 'node:test';import assert from 'node:assert/strict';
import express from 'express';
import {RequestLimits,validateRequestObject,credentialBucket,installHttpSecurity} from './http-security';
import {AnswerJobs} from './answer-jobs';
test('request validation rejects operator/prototype injection and oversized nesting',()=>{
 for(const body of [null,[],JSON.parse('{"person_id":{"$ne":null}}'),JSON.parse('{"__proto__":{"admin":true}}'),{x:{constructor:{}}}])assert.throws(()=>validateRequestObject(body));
 let nested:any={};for(let i=0;i<14;i++)nested={x:nested};assert.throws(()=>validateRequestObject(nested));
 assert.doesNotThrow(()=>validateRequestObject({question:'What is $5?',evidence:{text:'ordinary text'},items:['a','b']}));
});
test('rate limits are isolated, expire, and credential buckets do not contain secrets',()=>{
 let now=0;const limiter=new RequestLimits(()=>now);limiter.take('ip:a',2);limiter.take('ip:a',2);assert.throws(()=>limiter.take('ip:a',2));assert.doesNotThrow(()=>limiter.take('ip:b',2));now=60001;assert.doesNotThrow(()=>limiter.take('ip:a',2));assert.equal(credentialBucket('secret').length,64);assert.ok(!credentialBucket('secret').includes('secret'));
});
test('answer concurrency is limited per actor and cancellation releases capacity',()=>{
 const jobs=new AnswerJobs();const run=async()=>new Promise(()=>{});try{const one=jobs.start('a',run);jobs.start('a',run);assert.throws(()=>jobs.start('a',run));assert.doesNotThrow(()=>jobs.start('b',run));jobs.cancel(one.jobId,'a');assert.doesNotThrow(()=>jobs.start('a',run));}finally{jobs.close();}
});
test('browser hardening headers cover API errors and do not advertise Express',async t=>{
 const app=express();installHttpSecurity(app);app.get('/api/check',(_req,res)=>{res.status(401).json({error:'test'});});const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));t.after(()=>server.close());const r=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/check`);assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('x-powered-by'),null);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(r.headers.get('content-security-policy')!,/frame-ancestors 'none'/);
});
