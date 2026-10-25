import test from 'node:test';import assert from 'node:assert/strict';import {povChoices} from './povChoices';
test('first person choices progress from action to recall without silently repeating the event',()=>{
 assert.ok(povChoices('kitchen',[]).some(c=>c.action==='breakfast'));
 const after=povChoices('kitchen',['breakfast']);assert.ok(!after.some(c=>c.action==='breakfast'));assert.ok(after.some(c=>c.question?.includes('breakfast')));
 const family=povChoices('lounge',['daughter']);assert.ok(family.some(c=>c.dialogue));assert.ok(family.some(c=>c.question?.includes('Sarah')));
});
test('day two offers dated recall and new activities, not yesterday’s unplayed events',()=>{
 const kitchen=povChoices('kitchen',['next_day']);assert.ok(kitchen.some(c=>c.action==='breakfast2'));assert.ok(!kitchen.some(c=>c.action==='breakfast'));
 const bedroom=povChoices('bedroom',['next_day']);assert.ok(bedroom.some(c=>c.question==='Who visited me yesterday?'));assert.ok(bedroom.some(c=>c.action==='reminder2'));
});
test('contact is offered only after a reported lost event, includes a decline choice, and disappears once acknowledged',()=>{
 assert.ok(!povChoices('cafe',[]).some(c=>c.action==='contact'));
 const offered=povChoices('cafe',['lost']);assert.ok(offered.some(c=>c.action==='contact'));assert.ok(offered.some(c=>c.dialogue?.[0].startsWith('Not yet')));
 assert.ok(!povChoices('cafe',['lost','contact']).some(c=>c.action==='contact'));
});

test('sandbox keeps unplayed activities and conversation branches available on either day',async()=>{
 const {sandboxChoices}=await import('./povChoices');
 const choices=sandboxChoices('lounge',['next_day','daughter','daughter2','glasses','physio']);
 for(const action of ['daughter','daughter2','glasses','physio'])assert.ok(choices.some(c=>c.action===action));
 assert.ok(choices.some(c=>c.dialogue));assert.ok(choices.some(c=>c.question));
});

test('scene menus preserve every sandbox choice exactly once, including unlocked contact',async()=>{
 const {sceneGroups}=await import('./sceneGroups');const {sandboxChoices}=await import('./povChoices');
 for(const room of ['bedroom','kitchen','lounge','garden','cafe'])for(const done of [[],['lost','daughter','next_day']]){
  const labels=sceneGroups(room,done).flatMap(g=>g.choices.map(c=>c.label));
  assert.deepEqual(labels.sort(),sandboxChoices(room,done).map(c=>c.label).sort());
  assert.equal(new Set(labels).size,labels.length);
 }
 assert.ok(sceneGroups('lounge',[]).find(g=>g.key==='colour')?.choices.some(c=>c.action==='color_green'));
 assert.ok(sceneGroups('cafe',['lost']).find(g=>g.key==='support')?.choices.some(c=>c.action==='contact'));
});

test('simulation startup shares a single new run and resumes it on subsequent mounts',async()=>{
 const {loadSimulationSession}=await import('./simulationSession');let value:string|null=null,starts=0;
 const storage={getItem:()=>value,setItem:(_k:string,v:string)=>{value=v;},removeItem:()=>{value=null;}};
 const request=async(path:string)=>{if(path==='/start'){starts++;await new Promise(r=>setTimeout(r,5));}return {runId:'same-run'};};
 const [a,b]=await Promise.all([loadSimulationSession(storage,request),loadSimulationSession(storage,request)]);
 assert.equal(a.runId,b.runId);assert.equal(starts,1);await loadSimulationSession(storage,request);assert.equal(starts,1);
});
test('simulation startup recovers expired IDs but does not create runs on network errors',async()=>{
 const {loadSimulationSession}=await import('./simulationSession');let value:string|null='expired',starts=0;
 const storage={getItem:()=>value,setItem:(_k:string,v:string)=>{value=v;},removeItem:()=>{value=null;}};
 await loadSimulationSession(storage,async(path)=>{if(path==='/state')throw Object.assign(Error('expired'),{status:404});starts++;return {runId:'fresh'};});
 assert.equal(value,'fresh');assert.equal(starts,1);
 await assert.rejects(loadSimulationSession(storage,async()=>{throw Error('network failed');}),/network failed/);assert.equal(value,'fresh');
});

test('game caregiver commands bypass recall while questions, refusals and hypotheticals do not trigger arrival',async()=>{
 const {gameAssistance:route}=await import('./gameAssistance');
 for(const phrase of ['call sam , i am feeling sick','call her forhelp','please contact my caregiver','can you ask Sam to come here?'])assert.equal(route(phrase),'request',phrase);
 assert.equal(route('i need help'),'offer');assert.equal(route('yes please',true),'request');assert.equal(route('yes please',false),'none');
 assert.equal(route('Who is Sam?'),'none');assert.equal(route('Do not call Sam'),'none');assert.equal(route('not now',true),'decline');assert.equal(route('What happens if I call Sam?'),'none');
});


test('typed breakfast preferences accept alternatives without inventing completed meals',async()=>{
 const {breakfastChoice}=await import('./storyChoice');
 assert.equal(breakfastChoice('i like cereals'),'cereals');assert.equal(breakfastChoice('steak'),'steak');assert.equal(breakfastChoice('cereal please'),'cereal');
 assert.equal(breakfastChoice('I would like pancakes please'),'pancakes');
 assert.equal(breakfastChoice("I'd prefer fruit"),'fruit');
 for(const q of ['Did I eat cereal?', 'Who is Sarah?', 'I want to call Sam', "I don't want cereals", 'I am allergic to nuts']) assert.equal(breakfastChoice(q),null,q);
});


test('all fifteen story scenes accept relevant typed decisions without completing unrelated chat',async()=>{
 const {storyDecision:d}=await import('./storyChoice');
 const examples=['I put my glasses in the drawer','I prefer cereals','Where are my glasses?','Did I eat breakfast?','Who is Sarah?','I would like to look at photos','I want to sit on the bench','Thanks','I would rather rest','I will stay by the cafe entrance','Not yet','tomorrow','What happened yesterday?','I left my glasses in my bag','Where were my glasses yesterday?'];
 examples.forEach((text,i)=>assert.ok(d(i,text),`scene ${i+1}: ${text}`));
 examples.forEach((_,i)=>assert.equal(d(i,'hello'),null));
 assert.equal(d(0,'Where are my glasses?'),null);
 assert.equal(d(1,'What is the weather?'),null);
 assert.equal(d(8,'Who is David?'),null);
 assert.equal(d(11,'tomorrow'),'next_day');
});
