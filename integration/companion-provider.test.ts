import test from 'node:test';import assert from 'node:assert/strict';
import {compatibleClient,companionSettings} from './companion-provider';
test('free provider translates schema and cancellation without enabling tools or paid fallbacks',async()=>{
 const signal=new AbortController().signal;
 const client=compatibleClient('openrouter',async(url:any,request:any)=>{
  assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(request.signal,signal);
  const body=JSON.parse(request.body);assert.equal(body.model,'openrouter/free');assert.equal(body.provider.data_collection,'deny');assert.equal(body.tools,undefined);assert.equal(body.response_format.json_schema.schema.type,'object');
  return {ok:true,json:async()=>({model:'selected/free',choices:[{message:{content:'{"supported":true}'}}]})} as Response;
 });
 const result=await client.interactions.create({model:'openrouter/free',input:'synthetic',response_format:{schema:{type:'object'}},generation_config:{max_output_tokens:100}},{signal});assert.equal(result.output_text,'{"supported":true}');assert.equal(result.model,'selected/free');
 await assert.rejects(client.interactions.create({model:'paid/model',input:'test'},{}),/Paid model/);
});
test('provider failures do not leak raw response bodies or return made-up text',async()=>{
 const client=compatibleClient('openrouter',async()=>({ok:false,status:429,json:async()=>({secret:'not exposed'})}) as Response);
 await assert.rejects(client.interactions.create({model:'openrouter/free',input:'test'},{}),(e:any)=>e.status===429&&!e.message.includes('secret'));
 const empty=compatibleClient('openrouter',async()=>({ok:true,json:async()=>({choices:[]})}) as Response);
 await assert.rejects(empty.interactions.create({model:'openrouter/free',input:'test'},{}),/no usable text/);
});
test('local model receives schema and does not receive an external API credential',async()=>{
 const client=compatibleClient('ollama',async(url:any,request:any)=>{assert.match(url,/127.0.0.1:11434\/api\/chat/);assert.equal(request.headers.Authorization,undefined);const body=JSON.parse(request.body);assert.equal(body.stream,false);assert.deepEqual(body.format,{type:'object'});return {ok:true,json:async()=>({model:'local-test',message:{content:'{}'}})} as Response;});
 assert.equal((await client.interactions.create({model:'local-test',input:'test',response_format:{schema:{type:'object'}}},{})).output_text,'{}');
});
