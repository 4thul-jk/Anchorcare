import dotenv from 'dotenv';import {MongoClient,BSON} from 'mongodb';import {mkdir,writeFile} from 'node:fs/promises';import {describeStorage} from './storage-catalog';
dotenv.config({quiet:true});
const client=new MongoClient(process.env.MONGODB_URI!,{serverSelectionTimeoutMS:10000});await client.connect();
try{
 const db=client.db(process.env.MONGODB_DATABASE||'engram');const scope={householdId:process.env.HOUSEHOLD_ID||'demo-household',subjectId:{$in:(process.env.SUBJECT_IDS||'margaret').split(',').map(s=>s.trim())}};
 const filter={...scope,expiresAt:{$lt:new Date()}},rows=await db.collection('mobile_pairings').find(filter).toArray();
 console.log(JSON.stringify({database:db.databaseName,mode:process.argv.includes('--apply')?'apply':'dry_run',removableExpiredPairingCodes:rows.length,collections:await describeStorage(db)}));
 if(process.argv.includes('--apply')&&rows.length){
  const folder='.private-backups/storage-cleanup-'+new Date().toISOString().replace(/[:.]/g,'-');await mkdir(folder,{recursive:true});await writeFile(folder+'/expired-pairings.ejson',BSON.EJSON.stringify(rows));
  const result=await db.collection('mobile_pairings').deleteMany({...filter,_id:{$in:rows.map(r=>r._id)}});console.log(JSON.stringify({removedExpiredPairingCodes:result.deletedCount,backupFolder:folder,otherDataDeleted:false}));
 }
}finally{await client.close();}
