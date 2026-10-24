export function localDemoAccess(req:any,patient:string){
 return process.env.DEMO_PATIENT_AUTOLOGIN==='true'&&process.env.NODE_ENV!=='production'&&patient==='demo-person-001'
  &&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')
  &&['localhost','127.0.0.1','[::1]'].includes(req.hostname);
}
