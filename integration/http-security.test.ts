import {validatePublicDemo,publicDemoRoute} from './demo-access';
import {judgeInvite,validJudgeInvite,judgeCookie} from './judge-access';
test('judge invitations are signed, expiring, bounded and extracted from private cookies',()=>{
 const now=Date.now(),token=judgeInvite('test-secret',now+60000);
 assert.equal(validJudgeInvite(token,'test-secret',now),true);
 assert.equal(validJudgeInvite(token,'different-secret',now),false);
 assert.equal(validJudgeInvite(token,'test-secret',now+60001),false);
 assert.equal(validJudgeInvite(token+'x','test-secret',now),false);
 assert.equal(validJudgeInvite(judgeInvite('test-secret',now+26*3600000),'test-secret',now),false);
 assert.equal(judgeCookie('unrelated=x; muse_judge='+token),token);
 assert.equal(judgeCookie(undefined),'');
});
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

import {localDemoAccess} from './demo-access';
test('demo access is explicit, loopback only, fixed patient and disabled in production',t=>{
 const original=process.env.DEMO_PATIENT_AUTOLOGIN,mode=process.env.NODE_ENV;t.after(()=>{if(original===undefined)delete process.env.DEMO_PATIENT_AUTOLOGIN;else process.env.DEMO_PATIENT_AUTOLOGIN=original;if(mode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=mode;});
 process.env.DEMO_PATIENT_AUTOLOGIN='true';process.env.NODE_ENV='development';
 const req={socket:{remoteAddress:'127.0.0.1'},hostname:'127.0.0.1'};assert.equal(localDemoAccess(req,'demo-person-001'),true);
 assert.equal(localDemoAccess({...req,hostname:'evil.example'},'demo-person-001'),false);
 assert.equal(localDemoAccess({...req,socket:{remoteAddress:'10.0.0.2'}},'demo-person-001'),false);
 assert.equal(localDemoAccess(req,'real-patient'),false);process.env.NODE_ENV='production';assert.equal(localDemoAccess(req,'demo-person-001'),false);
});


test('key-free public access fails closed on private databases and blocks sensitive actions',t=>{
 const old=process.env.PUBLIC_PATIENT_DEMO;process.env.PUBLIC_PATIENT_DEMO='true';t.after(()=>{if(old===undefined)delete process.env.PUBLIC_PATIENT_DEMO;else process.env.PUBLIC_PATIENT_DEMO=old;});
 assert.throws(()=>validatePublicDemo({mode:'mongodb',database:'engram',householdId:'anchorcare-demo'},'demo-person-001'));
 assert.equal(validatePublicDemo({mode:'mongodb',database:'muse_public_demo',householdId:'muse-public-demo'},'demo-person-001'),true);
 for(const path of ['/admin/storage','/location','/agent/capture','/agent/snapshot','/mobile/sos','/admin/people'])assert.equal(publicDemoRoute('POST',path),false);
 assert.equal(publicDemoRoute('GET','/status'),true);assert.equal(publicDemoRoute('POST','/agent/turn'),true);
});
