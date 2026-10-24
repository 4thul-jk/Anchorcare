import {normaliseRecallQuery,queryWords} from './query-language';
import {randomUUID} from 'node:crypto';
import {GridFSBucket,ObjectId} from 'mongodb';
import {ApiError,id,text,choice} from '../engram-retrieval/src/validation.js';
const MAX_BYTES=1024*1024;
const words=queryWords;
const stop=new Set('a an the i me my our us of for to in on at show picture pictures photo photos image images remember memory memories close familiar please can you do who is are this that family member tell about some saved'.split(' '));
export function validateImage(contentType:unknown,encoded:unknown){
 const type=choice(contentType,['image/png','image/jpeg','image/webp'],'content_type');
 if(typeof encoded!=='string'||encoded.length>Math.ceil(MAX_BYTES*4/3)+8||!encoded.length||!/^[a-zA-Z0-9+/]*={0,2}$/.test(encoded))throw new ApiError(400,'Invalid image encoding; use an image under 1 MB');
 const bytes=Buffer.from(encoded,'base64');if(!bytes.length||bytes.length>MAX_BYTES)throw new ApiError(400,'Image must be under 1 MB');
 const png=bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
 const webp=bytes.length>=16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(type==='image/png'&&!png||type==='image/jpeg'&&!jpg||type==='image/webp'&&!webp)throw new ApiError(400,'Image bytes do not match the declared format');
 if(png){const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(!width||!height||width*height>16000000)throw new ApiError(400,'Image dimensions are too large');}
 return {bytes,contentType:type};
}
export class ImageMemory{
 constructor(private service:any){}
 private metadata(asset:any){const {data,gridFsId,...result}=asset;return result;}
 private async target(patient:string,kind:string,targetId:string,approved:boolean){
  const scope=this.service.scope(patient),store=this.service.store;
  if(kind==='person'){
   const person=await store.one('people',{...scope,_id:targetId});if(!person)return null;
   if(approved){const records=await store.list('personal_records',{...scope,personId:targetId,reviewStatus:'approved'}, {},100);
    if(!records.some((r:any)=>typeof r.originalText==='string'&&r.originalText.includes(person.name)))return null;
   }
   return person;
  }
  return store.one('episodes',{...scope,_id:targetId,...(approved?{isCurrent:true,reviewStatus:'approved'}:{})});
 }
 async upload(patient:string,input:any){
  const scope=this.service.scope(patient),kind=choice(input.target_type,['person','episode'],'target_type'),targetId=id(input.target_id,'target_id');
  if(!await this.target(patient,kind,targetId,false))throw new ApiError(400,'Create the person or memory in this patient scope first');
  const image=validateImage(input.content_type,input.image_base64);
  const asset:any={_id:'image_'+randomUUID(),...scope,targetType:kind,targetId,caption:text(input.caption,'caption',500),contentType:image.contentType,byteLength:image.bytes.length,reviewStatus:'draft',createdAt:this.service.clock()};
  if(this.service.store.mode==='mongodb'){
   asset.gridFsId=new ObjectId();const bucket=new GridFSBucket(this.service.store.db,{bucketName:'engram_images'});
   await new Promise<void>((resolve,reject)=>{const stream=bucket.openUploadStreamWithId(asset.gridFsId,asset._id,{metadata:{...scope,contentType:image.contentType}});stream.on('error',reject);stream.on('finish',()=>resolve());stream.end(image.bytes);});
   try{await this.service.store.insert('memory_images',asset);}catch(e){await bucket.delete(asset.gridFsId).catch(()=>{});throw e;}
  }else{asset.data=image.bytes;await this.service.store.insert('memory_images',asset);}
  await this.service.audit(scope,'image_uploaded',asset._id);
  return {image:this.metadata(asset)};
 }
 async review(patient:string,input:any){
  const scope=this.service.scope(patient),asset=await this.service.store.one('memory_images',{...scope,_id:id(input.image_id)});
  if(!asset)throw new ApiError(404,'Image not found');
  const status=choice(input.status,['draft','approved'],'status');
  if(status==='approved'&&!await this.target(patient,asset.targetType,asset.targetId,true))throw new ApiError(409,'Approve the linked person record or current memory before approving its image');
  const image=await this.service.store.update('memory_images',{...scope,_id:asset._id},{reviewStatus:status,reviewedAt:this.service.clock()});
  await this.service.audit(scope,'image_reviewed',asset._id,{status});return {image:this.metadata(image)};
 }
 async list(patient:string){const records=await this.service.store.list('memory_images',this.service.scope(patient),{createdAt:-1},100);return {images:records.map((r:any)=>this.metadata(r))};}
 async content(patient:string,imageId:string,admin:boolean){
  const scope=this.service.scope(patient),asset=await this.service.store.one('memory_images',{...scope,_id:id(imageId)});
  if(!asset||(!admin&&(asset.reviewStatus!=='approved'||!await this.target(patient,asset.targetType,asset.targetId,true))))throw new ApiError(404,'Approved image not found');
  let bytes:Buffer;
  if(this.service.store.mode==='mongodb'){
   const bucket=new GridFSBucket(this.service.store.db,{bucketName:'engram_images'});const chunks:Buffer[]=[];let size=0;
   for await(const chunk of bucket.openDownloadStream(asset.gridFsId)){size+=chunk.length;if(size>MAX_BYTES)throw new ApiError(413,'Image exceeds allowed size');chunks.push(chunk);}
   bytes=Buffer.concat(chunks);
  }else bytes=Buffer.from(asset.data);
  return {bytes,contentType:asset.contentType};
 }
 async pictureAnswer(patient:string,question:string){
  const result=await this.recall(patient,question);
  if(!result.images.length)return null;
  const names=[...new Set(result.images.map((image:any)=>image.personName).filter(Boolean))];
  return {status:'answered',answer:names.length===1?`Here is a caregiver-labelled saved picture of ${names[0]}.`:'Here are the matching caregiver-labelled saved memory pictures.',
   images:result.images,verification:'approved_image_labels',conversational:false,imageQuery:question};
 }
 async recall(patient:string,question:unknown,referenceIds:unknown=[]){
  const query=text(question,'question',1000),q=words(query),terms=[...q].filter(w=>!stop.has(w)&&w.length>2);
  if(!Array.isArray(referenceIds)||referenceIds.length>20)throw new ApiError(400,'At most 20 record references are allowed');
  const references=new Set(referenceIds.map(r=>id(r,'reference_id')));
  const scope=this.service.scope(patient),store=this.service.store;
  const referencedPeople=new Set<string>();
  for(const reference of references){
   const record=await store.one('personal_records',{...scope,_id:reference,reviewStatus:'approved'});if(record?.personId)referencedPeople.add(record.personId);
   const episode=await store.one('episodes',{...scope,_id:reference,isCurrent:true,reviewStatus:'approved'});for(const personId of episode?.personIds||[])referencedPeople.add(personId);
  }
  const assets=await store.list('memory_images',{...scope,reviewStatus:'approved'},{createdAt:-1},100);
  const personIds=[...new Set(assets.filter((a:any)=>a.targetType==='person').map((a:any)=>a.targetId))];
  const episodeIds=[...new Set(assets.filter((a:any)=>a.targetType==='episode').map((a:any)=>a.targetId))];
  const [people,cards,episodes]=await Promise.all([
   personIds.length?store.list('people',{...scope,_id:{$in:personIds}},{},100):[],
   personIds.length?store.list('personal_records',{...scope,personId:{$in:personIds},reviewStatus:'approved'},{},500):[],
   episodeIds.length?store.list('episodes',{...scope,_id:{$in:episodeIds},isCurrent:true,reviewStatus:'approved'},{},100):[]
  ]);
  const approvedPeople=new Map(people.filter((person:any)=>cards.some((card:any)=>card.personId===person._id&&typeof card.originalText==='string'&&card.originalText.includes(person.name))).map((person:any)=>[person._id,person]));
  const approvedEpisodes=new Map(episodes.map((episode:any)=>[episode._id,episode]));
  const results:any[]=[];
  const family=/\b(?:family|relatives)\b/i.test(query)&&terms.length===0;
  for(const asset of assets){
   const target:any=asset.targetType==='person'?approvedPeople.get(asset.targetId):approvedEpisodes.get(asset.targetId);if(!target)continue;
   let score=0,personName:string|undefined;
   if(asset.targetType==='person'){
    const nameWords=[...words(target.name)];const first=nameWords[0];
    const named=first&&q.has(first)||normaliseRecallQuery(query).includes(normaliseRecallQuery(target.name));
    const relation=String(target.relationship||'').toLowerCase();const related=relation&&[...words(relation)].every(w=>q.has(w));
    if(named||related||family||referencedPeople.has(asset.targetId)){score=named?10:related?8:referencedPeople.has(asset.targetId)?7:2;personName=target.name;}
   }else{
    const caption=words(asset.caption+' '+(target.summary||''));score=references.has(asset.targetId)?10:terms.filter(w=>caption.has(w)).length;
   }
   if(score)results.push({...this.metadata(asset),personName,score,interpretation:'Caregiver-labelled saved picture; no face recognition or visual identity verification.'});
  }
  results.sort((a,b)=>b.score-a.score);
  return {images:results.slice(0,4),requested:/\b(?:photo|photos|picture|pictures|image|images|show|remember|memory|memories)\b/i.test(query),selection:'Approved pictures matched by saved person/relationship labels or memory captions; not visual recognition.'};
 }
}
