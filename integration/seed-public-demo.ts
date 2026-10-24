import dotenv from 'dotenv';import {MongoClient} from 'mongodb';dotenv.config({quiet:true});
const privateDb=process.env.MONGODB_DATABASE||'engram';
Object.assign(process.env,{STORE:'mongodb',MONGODB_DATABASE:'muse_public_demo',HOUSEHOLD_ID:'muse-public-demo',ANCHORCARE_PATIENT_ID:'demo-person-001',SUBJECT_IDS:'demo-person-001'});
await import('./seed-demo');if(process.exitCode)throw Error('Fictional seed failed');await import('./seed-image-demo');if(process.exitCode)throw Error('Fictional image seed failed');
const c=new MongoClient(process.env.MONGODB_URI!);await c.connect();try{const db=c.db('muse_public_demo');
 const original:any[]=await c.db(privateDb).collection('episodes').listSearchIndexes().toArray();const existing=await db.collection('episodes').listSearchIndexes().toArray();
 for(const index of original)if(!existing.some(i=>i.name===index.name)&&index.latestDefinition)await db.collection('episodes').createSearchIndex({name:index.name,type:index.type,definition:index.latestDefinition});
 for(const [collection,field] of [['agent_capture_turns','recordedAt'],['agent_sessions','startedAt'],['agent_session_reports','createdAt']])await db.collection(collection).createIndex({[field]:1},{expireAfterSeconds:3600});
 console.log(JSON.stringify({publicDemoDatabase:db.databaseName,fictionalSeedOnly:true,indexDefinitionsCopied:original.length,guestConversationRetentionSeconds:3600,privateDataCopied:false}));
}finally{await c.close();}
