// Share startup across React StrictMode effects and simultaneous mounts.
let pending:Promise<any>|null=null;
export function loadSimulationSession(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,request:(path:string,body?:any,id?:string)=>Promise<any>){
 if(pending)return pending;
 pending=(async()=>{let data:any;const saved=storage.getItem('engram-simulation-run');
  if(saved){try{data=await request('/state',{},saved);}catch(e:any){if(e.status!==404)throw e;storage.removeItem('engram-simulation-run');}}
  if(!data)data=await request('/start');storage.setItem('engram-simulation-run',data.runId);return data;
 })().finally(()=>{pending=null;});return pending;
}
