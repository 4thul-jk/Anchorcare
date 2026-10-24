import test from 'node:test';import assert from 'node:assert/strict';
import {SupportSessions} from './support-session';import {routeQuestion} from './question-routing';import {immediateSupport} from './response-speed';import {validateMemoryTool} from './memory-tools';
const now=new Date('2026-10-24T10:00:00Z');
const memoryQuestions=['is anyone visiting me today?','Is Anyone Visiting Today','Who Is Sarah','Can you tell me my name?','my name','I cannot remember my name','I am confused about my medicine','When did I call my daughter?','Has my daughter visited?','Tell me about Sarah','Do I have visitors today?','Did I take my pills yesterday?'];
for(const question of memoryQuestions)test('audit: lost -> memory: '+question,()=>{
 const flow=new SupportSessions();const lost=flow.respond('I am lost',null,'p')!;assert.equal(flow.respond(question,lost.supportSession,'p'),null);
});
for(const question of ['I am lost','Where am I?',"I don't know where I am",'i dont know where i am'])test('audit: disorientation: '+question,()=>assert.ok(immediateSupport(question)));
for(const question of ['Will Sarah visit today?','Any visits today?','Who is stopping by today?'])test('audit: upcoming visitor: '+question,()=>assert.ok(routeQuestion(question,'Europe/London',now).include.includes('plans')));
for(const question of ['What pills did I take yesterday?','Did I take my tablets today?'])test('audit: medication wording: '+question,()=>assert.equal(routeQuestion(question,'Europe/London',now).activity,'medication'));
test('audit: provider cannot override an explicit date or silently collapse two dates',()=>{
 assert.throws(()=>validateMemoryTool({sections:['daily_logs'],day:'today',activity:'medication'},'Did I take my medicine yesterday?','Europe/London',now));
 assert.throws(()=>validateMemoryTool({sections:['episodes'],day:'today'},'What happened today and yesterday?','Europe/London',now));
 assert.throws(()=>routeQuestion('Who visited yesterday and who is coming tomorrow?','Europe/London',now));
});
test('audit: expired session cannot leak its conversation into a fresh question',()=>{
 const flow=new SupportSessions();const first=flow.respond('I am lost',null,'p',0)!;
 assert.equal(flow.respond('my name',first.supportSession,'p',600001),null);
 assert.deepEqual(flow.history(first.supportSession!,'p'),[]);
});

for(const greeting of ['hello','contact my caregiver'])test('audit: '+greeting+' does not capture later repeated memory questions',()=>{
 for(const question of memoryQuestions){const flow=new SupportSessions();const first=flow.respond(greeting,null,'p')!;assert.equal(flow.respond(question,first.supportSession,'p'),null);assert.equal(flow.respond(question,first.supportSession,'p'),null);}
});
test('audit: explicit relative dates are enforced over London DST',()=>{
 const next=validateMemoryTool({sections:['plans'],day:'tomorrow'},'Who is visiting tomorrow?','Europe/London',now);
 assert.equal(+new Date(next.plan_range.end)-+new Date(next.plan_range.start),25*3600000);
 assert.throws(()=>validateMemoryTool({sections:['plans'],day:'none'},'Who is visiting tomorrow?','Europe/London',now));
 assert.equal(routeQuestion('What happened last night?','Europe/London',now).time_range.end,'2026-10-23T23:00:00.000Z');
});

test('possessive daughter image wording routes to personal records, including common typos',()=>{
 for(const question of ['show me my daughters image',"show my daughter's picture",'show my daughter’s photo','show my daughers image','show my daugthers picture'])assert.deepEqual(routeQuestion(question,'Europe/London',now).include,['personal_records']);
});

test('possessive normalisation preserves question contractions',()=>{
 assert.deepEqual(routeQuestion("Who's Sarah?",'Europe/London',now).include,['personal_records']);
 assert.deepEqual(routeQuestion("What's my name?",'Europe/London',now).include,['personal_records']);
});
