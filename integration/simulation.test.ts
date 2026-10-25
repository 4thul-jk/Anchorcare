import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryStore} from '../engram-retrieval/src/store.js';
import {SimulationEngine,isolatedSimulationConfig} from './simulation';
const cfg={simulationDailyXp:1000,timezone:'Europe/London',subjectIds:['demo-person-001'],householdId:'anchorcare-demo',quietStart:'22:00',quietEnd:'07:00',cooldownSeconds:30};
test('simulation ingests real records, replays without duplicates, produces scheduled reminder and resets only its run',async()=>{
 const store=new MemoryStore();await store.insert('daily_logs',{_id:'main-record',householdId:'anchorcare-demo',subjectId:'demo-person-001'});
 const engine=new SimulationEngine(store,cfg),r=await engine.start(),other=await engine.start();
 await engine.action(r.runId,'breakfast');await engine.action(r.runId,'glasses');const replay=await engine.action(r.runId,'glasses');assert.equal(replay.logs.length,2);assert.ok("replayed" in replay && replay.replayed);
 const answer=await engine.ask(r.runId,'Where are my glasses?',false);assert.match(answer.answer,/bookshelf/);assert.equal(answer.citations.length,1);
 const otherAnswer=await engine.ask(other.runId,'Where are my glasses?',false);assert.equal(otherAnswer.citations.length,0);
 const reminder=await engine.action(r.runId,'reminder');assert.equal(reminder.prompts.length,1);assert.match(reminder.prompts[0].message,/David Lee/);
 const clock=+new Date(reminder.clock);const late=await engine.action(r.runId,'garden');assert.equal(+new Date(late.clock),clock);
 await assert.rejects(engine.action(r.runId,'contact'));await engine.action(r.runId,'lost');const contact=await engine.action(r.runId,'contact');assert.ok("simulatedContact" in contact && contact.simulatedContact);
 assert.equal((await store.list('mobile_commands')).length,0);assert.equal((await store.list('telegram_deliveries')).length,0);
 await engine.remove(r.runId);assert.ok(await store.one('daily_logs',{_id:'main-record'}));assert.ok(engine.get(other.runId));assert.equal((await store.list('daily_logs',{subjectId:r.patientId})).length,0);
});
test('simulation supports grounded family picture and rejects invalid or cross-run operations',async()=>{
 const engine=new SimulationEngine(new MemoryStore(),cfg),r=await engine.start();
 const answer=await engine.ask(r.runId,'Show my daughter',false);assert.match(answer.answer,/Sarah Mercer/);assert.equal(answer.picture,'/simulation/sarah.png');
 await assert.rejects(engine.action(r.runId,'dropDatabase'));await assert.rejects(engine.ask(r.runId,'x'.repeat(601),false));assert.throws(()=>engine.get('not-a-run'));
 engine.get(r.runId).busy=true;await assert.rejects(engine.remove(r.runId));engine.get(r.runId).busy=false;await engine.remove(r.runId);
});
test('two-day recall keeps yesterday, latest location and visits separate and fires each day’s reminders',async()=>{
 const engine=new SimulationEngine(new MemoryStore(),cfg),r=await engine.start();
 await assert.rejects(engine.action(r.runId,'breakfast2'));
 for(const action of ['breakfast','glasses','daughter','reminder','physio','evening','next_day','breakfast2','glasses2'])await engine.action(r.runId,action);
 const yesterday=await engine.ask(r.runId,'Where were my glasses yesterday?',false),latest=await engine.ask(r.runId,'Where are my glasses now?',false);
 assert.match(yesterday.answer,/bookshelf/);assert.doesNotMatch(yesterday.answer,/counter/);assert.match(latest.answer,/counter/);assert.doesNotMatch(latest.answer,/bookshelf/);
 const visitors=await engine.ask(r.runId,'Who visited yesterday?',false);assert.match(visitors.answer,/Sarah/);assert.match(visitors.answer,/David/);
 const breakfast=await engine.ask(r.runId,'What did I have for breakfast today?',false);assert.match(breakfast.answer,/scrambled eggs/);assert.doesNotMatch(breakfast.answer,/oatmeal/);
 const oldBreakfast=await engine.ask(r.runId,'What did I have for breakfast yesterday?',false);assert.match(oldBreakfast.answer,/oatmeal/);assert.doesNotMatch(oldBreakfast.answer,/scrambled/);
 const both=await engine.ask(r.runId,'What did I have for breakfast on both days?',false);assert.match(both.answer,/oatmeal/);assert.match(both.answer,/scrambled/);
 await assert.rejects(engine.action(r.runId,'lunch'));
 const second=await engine.action(r.runId,'reminder2');assert.equal(second.dayNumber,2);assert.equal(second.prompts.length,2);assert.match(second.prompts[1].message,/Sarah/);
 const album=await engine.action(r.runId,'album_reminder');assert.equal(album.prompts.length,3);
});

test('sandbox retains activities across days, repeats with unique timestamps, and crosses reminder windows',async()=>{
 const engine=new SimulationEngine(new MemoryStore(),cfg),r=await engine.start();
 const options={sandbox:true,requestId:'sandbox-action-one'};
 const first=await engine.action(r.runId,'glasses',options);
 assert.equal(+new Date(first.clock),+new Date(r.clock));
 const duplicate=await engine.action(r.runId,'glasses',options);assert.equal(duplicate.logs.length,1);
 const later=await engine.advance(r.runId,60);assert.equal(+new Date(later.clock)-+new Date(r.clock),3600000);
 const second=await engine.action(r.runId,'glasses',{sandbox:true,requestId:'sandbox-action-two'});assert.equal(second.logs.length,2);
 await engine.action(r.runId,'next_day',{sandbox:true,requestId:'sandbox-next-day'});
 const third=await engine.action(r.runId,'breakfast',{sandbox:true,requestId:'sandbox-old-choice'});assert.equal(third.dayNumber,2);assert.equal(third.logs.length,4);
 const advanced=await engine.advance(r.runId,600);assert.equal(advanced.prompts.length,3);
 await assert.rejects(engine.advance(r.runId,-60));await assert.rejects(engine.advance(r.runId,1440));
 const recall=await engine.ask(r.runId,'What did I eat today?',false);assert.match(recall.answer,/oatmeal/);
});

test('Alex database configuration is reserved and never inherits the main database or patient list',()=>{
 const main={...cfg,database:'engram',contextProcessing:'atlas',mode:'mongodb'};
 const sim=isolatedSimulationConfig(main);
 assert.equal(sim.database,'engram_alex_simulation');assert.equal(main.database,'engram');
 assert.equal(sim.householdId,'engram-simulation');assert.deepEqual(sim.subjectIds,[]);
 assert.equal(sim.contextProcessing,'local');assert.deepEqual(main.subjectIds,['demo-person-001']);
 assert.throws(()=>isolatedSimulationConfig({...main,database:'ENGRAM_ALEX_SIMULATION'}));
});

test('sandbox orders same-time moves and recalls beyond 50 events without stale scene flags',async()=>{
 const engine=new SimulationEngine(new MemoryStore(),cfg),r=await engine.start();
 for(let i=0;i<51;i++)await engine.action(r.runId,'glasses',{sandbox:true,requestId:'repeat-action-'+i});
 const last=await engine.action(r.runId,'glasses2',{sandbox:true,requestId:'counter-final-action'});
 assert.equal(last.logs.length,52);assert.ok(last.sceneFlags.includes('glasses2'));assert.ok(!last.sceneFlags.includes('glasses'));
 const answer=await engine.ask(r.runId,'Where are my glasses now?',false);assert.match(answer.answer,/counter/);
 const restored=await engine.state(engine.get(r.runId));assert.equal(restored.history.at(-1).question,'Where are my glasses now?');
 const morning=await engine.action(r.runId,'next_day',{sandbox:true,requestId:'next-day-test'});
 assert.ok(morning.sceneFlags.includes('glasses2'));assert.ok(!morning.sceneFlags.includes('daughter'));
});

test('conversation follows chosen visitors and preserves the activity context',async()=>{
 const engine=new SimulationEngine(new MemoryStore(),cfg),r=await engine.start();
 await engine.action(r.runId,'daughter',{sandbox:true,requestId:'context-sarah-visit'});
 const daughter=await engine.ask(r.runId,'Who is she? Show me her picture.',false);assert.match(daughter.answer,/Sarah/);assert.ok(daughter.picture);
 await engine.action(r.runId,'physio',{sandbox:true,requestId:'context-david-visit'});
 const david=await engine.ask(r.runId,'Who is he?',false);assert.match(david.answer,/David/);assert.doesNotMatch(david.answer,/Sarah/);
 const more=await engine.ask(r.runId,'Tell me more',false);assert.match(more.answer,/David/);
 const activity=await engine.ask(r.runId,'What did we do?',false);assert.match(activity.answer,/seated leg exercises/);
 const thanks=await engine.ask(r.runId,'thank you',false);assert.match(thanks.answer,/welcome/);assert.equal(thanks.citations.length,0);
});

test('arcade free text uses the main classification and commit pipeline only inside its simulation patient',async()=>{
 const {checkedTurn}=await import('./conversation-agent');
 const store=new MemoryStore();const quote='I like mint tea without sugar.';
 const engine=new SimulationEngine(store,cfg,async input=>checkedTurn({intent:'information',question_text:null,topics:['preference'],items:[{memory_worthy:true,category:'personal',quote,title:'Tea preference',activity:'other',outcome:'uncertain',event_time:null}]},input.transcript));
 const r=await engine.start();const result=await engine.converse(r.runId,quote,'arcade-text-test');
 assert.equal(result.intent,'information');assert.equal(result.outputs[0].collection,'personal_records');
 const reports=await store.list('personal_records',{householdId:'engram-simulation',subjectId:r.patientId});assert.ok(reports.some((p:any)=>p.originalText===quote));
 assert.equal((await store.list('personal_records',{householdId:'anchorcare-demo'})).length,0);
 await engine.converse(r.runId,quote,'arcade-text-test');assert.equal((await store.list('agent_capture_turns')).length,1);
 await engine.remove(r.runId);assert.equal((await store.list('agent_capture_turns')).length,0);
});

test('daily XP budget is server enforced, idempotent, and resets by date while SOS remains available',async()=>{
 const engine=new SimulationEngine(new MemoryStore(),{...cfg,simulationDailyXp:10}),r=await engine.start();
 const first=await engine.action(r.runId,'color_blue',{sandbox:true,requestId:'blue-choice-01'});assert.equal(first.budget.remaining,5);
 const again=await engine.action(r.runId,'color_blue',{sandbox:true,requestId:'blue-choice-01'});assert.equal(again.budget.remaining,5);
 const answer=await engine.ask(r.runId,'What is my favourite colour?',false);assert.match(answer.answer,/blue/);assert.equal(answer.state.budget.remaining,0);
 await assert.rejects(engine.action(r.runId,'glasses',{sandbox:true,requestId:'blocked-choice'}),/XP/);
 await engine.action(r.runId,'lost',{sandbox:true,requestId:'safety-free-01'});await engine.action(r.runId,'contact',{sandbox:true,requestId:'safety-free-02'});
 const tomorrow=await engine.action(r.runId,'next_day',{sandbox:true,requestId:'next-morning-01'});assert.equal(tomorrow.budget.remaining,10);
 const bed=await engine.action(r.runId,'glasses_bed',{sandbox:true,requestId:'bedside-choice'});assert.equal(bed.budget.remaining,5);
 assert.match((await engine.ask(r.runId,'Where are my glasses now?',false)).answer,/bedside/);
});

test('caregiver arrival stays in the requested room, is free, and requires an assistance request',async()=>{
 const store=new MemoryStore(),engine=new SimulationEngine(store,cfg),r=await engine.start();
 await assert.rejects(engine.action(r.runId,'caregiver_arrived',{sandbox:true,requestId:'arrival-before-request',room:'bedroom'}),/Request caregiver/);
 const request=await engine.action(r.runId,'caregiver_request',{sandbox:true,requestId:'request-care-room',room:'bedroom'});
 const arrival=await engine.action(r.runId,'caregiver_arrived',{sandbox:true,requestId:'arrival-care-room',room:'bedroom'});
 assert.equal(arrival.budget.remaining,request.budget.total);assert.ok('event' in arrival);if('event' in arrival){assert.match(arrival.event.text,/bedroom/);assert.doesNotMatch(arrival.event.text,/café/);}
 assert.match(arrival.logs.at(-1).originalText,/does not establish any improvement/);
});


test('public simulation is explicit and requires a fixed HTTPS origin',async()=>{
 const {publicSimulationOrigin:origin}=await import('./simulation-access');
 assert.equal(origin({}),null);
 assert.equal(origin({PUBLIC_SIMULATION:'true',RENDER_EXTERNAL_URL:'https://demo.onrender.com'}),'https://demo.onrender.com');
 for(const value of ['http://demo.test','https://demo.test/path','https://user:pass@demo.test'])assert.throws(()=>origin({PUBLIC_SIMULATION:'true',PUBLIC_SIMULATION_ORIGIN:value}));
 assert.throws(()=>origin({PUBLIC_SIMULATION:'true'}));
});
