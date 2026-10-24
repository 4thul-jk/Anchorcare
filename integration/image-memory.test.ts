import test from 'node:test';import assert from 'node:assert/strict';
import {ImageMemory,validateImage} from './image-memory';import {MemoryStore} from '../engram-retrieval/src/store.js';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
async function fixture(){
 const store=new MemoryStore(),scope={householdId:'h',subjectId:'p'};
 const service={store,scope:(p:string)=>({householdId:'h',subjectId:p}),clock:()=>new Date(),audit:async()=>{}};
 await store.insert('people',{_id:'sarah',...scope,name:'Sarah Mercer',relationship:'daughter'});
 await store.insert('people',{_id:'david',...scope,name:'David Lee',relationship:'physiotherapist'});
 await store.insert('personal_records',{_id:'sarah_card',...scope,personId:'sarah',reviewStatus:'approved',originalText:'Sarah Mercer is the patient daughter.'});
 await store.insert('personal_records',{_id:'david_card',...scope,personId:'david',reviewStatus:'approved',originalText:'David Lee is the physiotherapist.'});
 await store.insert('episodes',{_id:'walk',...scope,isCurrent:true,reviewStatus:'approved',summary:'Garden walk with Sarah',personIds:['sarah']});
 return {store,scope,images:new ImageMemory(service)};
}
test('image bytes require allowed type, bounded size and matching signature',()=>{
 assert.equal(validateImage('image/png',png).contentType,'image/png');
 for(const [type,data]of [['image/svg+xml',png],['image/jpeg',png],['image/png',Buffer.from('<svg onload="bad"/>').toString('base64')],['image/png','x'.repeat(1500000)]])assert.throws(()=>validateImage(type,data));
});
test('pictures require caregiver approval and approved linked records; revocation takes effect on reads',async()=>{
 const f=await fixture();const result=await f.images.upload('p',{target_type:'person',target_id:'sarah',caption:'Fictional Sarah portrait',content_type:'image/png',image_base64:png});
 assert.equal('data' in result.image,false);assert.equal((await f.images.recall('p','Who is my daughter?')).images.length,0);
 await assert.rejects(f.images.content('p',result.image._id,false));
 assert.ok((await f.images.content('p',result.image._id,true)).bytes.length);
 await f.images.review('p',{image_id:result.image._id,status:'approved'});
 assert.equal((await f.images.recall('p','Show me Sarah')).images[0].personName,'Sarah Mercer');
 assert.equal((await f.images.recall('p','Who is my daughter?')).images.length,1);
 assert.equal((await f.images.recall('p','Who is David?')).images.length,0);
 await assert.rejects(f.images.content('other',result.image._id,true));
 await f.store.update('personal_records',{...f.scope,_id:'sarah_card'},{reviewStatus:'draft'});
 assert.equal((await f.images.recall('p','Show me Sarah')).images.length,0);await assert.rejects(f.images.content('p',result.image._id,false));
});
test('approved memory illustrations match captions or validated scoped record references, never withdrawn episodes',async()=>{
 const f=await fixture();const r=await f.images.upload('p',{target_type:'episode',target_id:'walk',caption:'Garden walk illustration',content_type:'image/png',image_base64:png});
 await f.images.review('p',{image_id:r.image._id,status:'approved'});
 assert.equal((await f.images.recall('p','Remember our garden walk')).images.length,1);
 assert.equal((await f.images.recall('p','Show the beach holiday')).images.length,0);
 assert.equal((await f.images.recall('p','Show that memory',['walk'])).images.length,1);
 await f.store.update('episodes',{...f.scope,_id:'walk'},{isCurrent:false});assert.equal((await f.images.recall('p','garden walk',['walk'])).images.length,0);
});
test('unknown people, external URLs and unscoped target IDs cannot create a visible image',async()=>{
 const f=await fixture();await assert.rejects(f.images.upload('p',{target_type:'person',target_id:'unknown',caption:'Unknown',content_type:'image/png',image_base64:png}));
 await assert.rejects(f.images.upload('p',{target_type:'person',target_id:'sarah',caption:'Unknown',content_type:'image/png',image_base64:'https://example.test/image.png'}));
 await assert.rejects(f.images.recall('p','q',Array(21).fill('walk')));
});

test('checked person references can resolve a visitor picture without trusting foreign records',async()=>{
 const f=await fixture();const asset=await f.images.upload('p',{target_type:'person',target_id:'sarah',caption:'Fictional Sarah illustration',content_type:'image/png',image_base64:png});await f.images.review('p',{image_id:asset.image._id,status:'approved'});
 assert.equal((await f.images.recall('p','Is anyone visiting?',['sarah_card'])).images[0].personName,'Sarah Mercer');
 assert.equal((await f.images.recall('other','Is anyone visiting?',['sarah_card'])).images.length,0);
 assert.equal((await f.images.recall('p','Who is my family doctor?')).images.length,0);
 await f.images.review('p',{image_id:asset.image._id,status:'draft'});assert.equal((await f.images.recall('p','Sarah',['sarah_card'])).images.length,0);
});

test('daughter image queries handle possessives and explicit common typos, but not an unknown person',async()=>{
 const f=await fixture();const r=await f.images.upload('p',{target_type:'person',target_id:'sarah',caption:'Fictional Sarah illustration',content_type:'image/png',image_base64:png});await f.images.review('p',{image_id:r.image._id,status:'approved'});
 for(const question of ['show me my daughters image',"show my daughter's picture",'show my daughter’s photo','show my daughers image','show my daugthers picture','show my duaghter photo',"Sarah's image"]){const result=await f.images.recall('p',question);assert.equal(result.images.length,1,question);assert.equal(result.images[0].personName,'Sarah Mercer');}
 assert.equal((await f.images.recall('p',"show me Thomas's image")).images.length,0);
});

test('a direct image request produces a friendly reply from approved image labels without inference',async()=>{
 const f=await fixture();const r=await f.images.upload('p',{target_type:'person',target_id:'sarah',caption:'Fictional Sarah illustration',content_type:'image/png',image_base64:png});await f.images.review('p',{image_id:r.image._id,status:'approved'});
 const reply=await f.images.pictureAnswer('p','show me my daughters image');assert.match(reply!.answer,/Sarah Mercer/);assert.equal(reply!.verification,'approved_image_labels');assert.equal(reply!.images.length,1);
 await f.images.review('p',{image_id:r.image._id,status:'draft'});assert.equal(await f.images.pictureAnswer('p','show me my daughters image'),null);
});

test('small encoded files cannot bypass JPEG or WebP pixel bounds',()=>{
 const jpeg=Buffer.from('ffd8ffc00011080001000103011100021100031100ffd9','hex');assert.equal(validateImage('image/jpeg',jpeg.toString('base64')).contentType,'image/jpeg');
 const large=Buffer.from(jpeg);large.writeUInt16BE(65535,7);large.writeUInt16BE(65535,9);assert.throws(()=>validateImage('image/jpeg',large.toString('base64')));
 const webp=Buffer.alloc(30);webp.write('RIFF');webp.writeUInt32LE(22,4);webp.write('WEBP',8);webp.write('VP8X',12);webp.writeUInt32LE(10,16);assert.equal(validateImage('image/webp',webp.toString('base64')).contentType,'image/webp');webp.writeUIntLE(16000,24,3);webp.writeUIntLE(16000,27,3);assert.throws(()=>validateImage('image/webp',webp.toString('base64')));
 assert.throws(()=>validateImage('image/jpeg',Buffer.from([255,216,255,217]).toString('base64')));
});


test('saved photo identification explains only the linked scoped identity and honours withdrawal',async()=>{
 const f=await fixture();const uploaded=await f.images.upload('p',{target_type:'person',target_id:'sarah',caption:'Fictional Sarah picture',content_type:'image/png',image_base64:png});
 assert.equal((await f.images.identifySaved('p',uploaded.image._id)).status,'no_support');
 await f.images.review('p',{image_id:uploaded.image._id,status:'approved'});
 const result=await f.images.identifySaved('p',uploaded.image._id);assert.match(result.answer,/Sarah Mercer, your daughter/);assert.equal(result.verification,'saved_person_image_link_not_face_recognition');
 assert.equal((await f.images.identifySaved('other',uploaded.image._id)).status,'no_support');
 await f.store.update('personal_records',{...f.scope,_id:'sarah_card'},{reviewStatus:'draft'});assert.equal((await f.images.identifySaved('p',uploaded.image._id)).status,'no_support');
});
