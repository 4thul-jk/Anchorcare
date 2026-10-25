import test from 'node:test';import assert from 'node:assert/strict';import {GeneralHelp,generalHelpKind,webEvidence} from './general-help';
process.env.COMPANION_PROVIDER='gemini';process.env.GEMINI_API_KEY='synthetic-web-test';
test('general help excludes personal and care queries, even with a model routing hint',()=>{
 for(const q of ['Who is my daughter?','What is my name?','What is my medicine?','What is Alex address?','I am lost'])assert.equal(generalHelpKind(q,'general'),null);
 assert.equal(generalHelpKind('What is photosynthesis?'),'general');assert.equal(generalHelpKind('Tell me a joke'),'general');assert.equal(generalHelpKind('Directions from Guildford station to Guildford castle'),'directions');
});
test('spoken public-question wrappers route to general help, while personal day summaries never become web questions',()=>{
 for(const q of ['Can you tell me what is photosynthesis?','I want to know what is the capital of France','Could you explain why is the sky blue?'])assert.equal(generalHelpKind(q),'general',q);
 for(const q of ['Give me the summary of previous day','Can you tell me my daughter name?','I need to know what I did yesterday'])assert.equal(generalHelpKind(q,'general'),null,q);
});
test('web call contains only current question and sources come from provider annotations',async()=>{
 let sent:any;const helper=new GeneralHelp(async()=>({interactions:{create:async(params:any)=>{sent=params;return {output_text:'A public answer.',steps:[{content:[{type:'text',annotations:[{type:'url_citation',url:'https://example.org/fact',title:'Evidence'}]}]}]};}}})as any);
 const answer=await helper.answer('What is photosynthesis?','general');assert.equal(sent.input,'What is photosynthesis?');assert.deepEqual(sent.tools,[{type:'google_search'}]);assert.equal(sent.store,false);assert.equal('previous_interaction_id'in sent,false);assert.equal(answer.responseSource,'web');assert.equal(answer.sources.length,1);
});
test('no source or provider failure cannot be presented as a verified web answer',async()=>{
 const helper=new GeneralHelp(async()=>({interactions:{create:async()=>({output_text:'Unverified fact'})}})as any);assert.equal((await helper.answer('What is the weather in London?','general')).responseSource,'web_unavailable');
 assert.equal(webEvidence({type:'url_citation',url:'javascript:alert(1)'}).sources.length,0);
});
test('directions use explicit origin/destination and nearby requests ask for location without a model call',async()=>{
 const helper=new GeneralHelp(async()=>{throw Error('Do not send anything');});
 const route=await helper.answer('Directions from Guildford station to Guildford castle','directions');assert.match(route.mapUrl!,/origin=Guildford%20station&destination=Guildford%20castle/);assert.doesNotMatch(route.answer,/I know where you are/);
 assert.equal((await helper.answer('weather near me','general')).responseSource,'location_needed');
});


test('spoken origin plus need-to-reach destination is used instead of asking again',async()=>{
 const helper=new GeneralHelp(async()=>{throw Error('No public search needed');});
 const result=await helper.answer('I am in London Victoria Coach Station. I need to reach Guildford railway station.','directions');assert.match(result.mapUrl!,/origin=London%20Victoria%20Coach%20Station&destination=Guildford%20railway%20station/);assert.match(result.answer,/You told me you are at London Victoria Coach Station/);
 const destination=await helper.answer('I need to go to Guildford. I need to know how to get there.','directions');assert.match(destination.answer,/get to Guildford/);assert.match(destination.answer,/starting from/);
});


test('web follow-up passes bounded public context and Muse style without rotating unsupported facts',async()=>{
 let sent:any;const helper=new GeneralHelp(async()=>({interactions:{create:async(p:any)=>{sent=p;return {output_text:'A new relevant detail.',steps:[{annotations:[{type:'url_citation',url:'https://example.org/detail'}]}]};}}})as any);
 await helper.answer('tell me more','general',undefined,[{question:'What is photosynthesis?',answer:'Plants use light.'}]);const payload=JSON.parse(sent.input);assert.equal(payload.currentQuestion,'tell me more');assert.equal(payload.previousPublicConversation[0].question,'What is photosynthesis?');assert.match(sent.system_instruction,/Muse/);assert.match(sent.system_instruction,/do not invent a different fact/);
});
test('consented GPS supplies Maps origin but only an explicitly supplied town reaches search',async()=>{
 let sent:any;const helper=new GeneralHelp(async()=>({interactions:{create:async(p:any)=>{sent=p;return {output_text:'A local forecast.',steps:[{annotations:[{type:'url_citation',url:'https://example.org/weather'}]}]};}}})as any);
 const device={fresh:true,latitude:51.234567,longitude:-.543219,publicArea:'Guildford'};
 const route=await helper.answer('Directions to Guildford castle','directions',undefined,[],device);
 assert.match(route.mapUrl!,/origin=51.234567%2C-0.543219/);assert.match(route.answer,/device location/);
 await helper.answer('weather near me','general',undefined,[],device);assert.match(sent.input,/Guildford/);assert.doesNotMatch(sent.input,/51\.234567|-0\.543219/);
 const missing=await helper.answer('weather near me','general',undefined,[],{...device,publicArea:null});assert.equal(missing.responseSource,'location_needed');
 const stale=await helper.answer('Directions to Guildford castle','directions',undefined,[],{...device,fresh:false});assert.doesNotMatch(stale.mapUrl!,/origin=/);
});
