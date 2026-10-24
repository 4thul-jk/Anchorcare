export function localDemoAccess(req:any,patient:string){
 return process.env.DEMO_PATIENT_AUTOLOGIN==='true'&&process.env.NODE_ENV!=='production'&&patient==='demo-person-001'
  &&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')
  &&['localhost','127.0.0.1','[::1]'].includes(req.hostname);
}

export function validatePublicDemo(cfg:any,patient:string){
 const enabled=process.env.PUBLIC_PATIENT_DEMO==='true';
 if(enabled&&(cfg.mode!=='mongodb'||cfg.database!=='muse_public_demo'||cfg.householdId!=='muse-public-demo'||patient!=='demo-person-001'))throw Error('Public patient demo requires its isolated fictional database and household');
 return enabled;
}
export function publicDemoRoute(method:string,path:string){
 if(method==='GET')return ['/status','/prompts','/capabilities','/agent/history','/agent/session/status'].includes(path)||/^\/images\/[a-zA-Z0-9_-]+\/content$/.test(path)||/^\/asks\/[a-f0-9-]+$/.test(path);
 if(method==='POST')return ['/ask','/asks','/recall-images','/identify-image','/agent/turn','/agent/commit','/agent/session/start','/agent/session/activity','/agent/session/pause','/agent/session/finish'].includes(path)||/^\/asks\/[a-f0-9-]+\/cancel$/.test(path);
 return false;
}
