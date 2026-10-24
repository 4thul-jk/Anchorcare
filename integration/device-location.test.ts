import test from 'node:test';import assert from 'node:assert/strict';import {DeviceLocation} from './device-location';import {MemoryStore} from '../engram-retrieval/src/store.js';
test('GPS requires consent, valid fresh coordinates and patient scope',async()=>{
 let now=new Date('2026-10-25T10:00:00Z');const store=new MemoryStore(),service={store,clock:()=>now,scope:(p:string)=>({householdId:'h',subjectId:p})};const location=new DeviceLocation(service),input={latitude:51.5,longitude:-.1,accuracy:20,captured_at:now.toISOString()};
 await assert.rejects(location.save('p',input));await assert.rejects(location.save('p',{...input,consent:true,latitude:99}));const saved=await location.save('p',{...input,consent:true});assert.equal(saved.fresh,true);assert.equal(await location.latest('other'),null);now=new Date(+now+300001);assert.equal((await location.latest('p'))!.fresh,false);
});
