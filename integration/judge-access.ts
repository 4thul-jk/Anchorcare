import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';

// Invitations grant companion access only, and only inside the fictional public database.
export function judgeInvite(secret:string, expires=Date.now()+7*24*60*60*1000){
 const payload=Buffer.from(JSON.stringify({expires,nonce:randomUUID()})).toString('base64url');
 return payload+'.'+createHmac('sha256',secret).update('judge:'+payload).digest('base64url');
}
export function validJudgeInvite(token:string,secret:string,now=Date.now()){
 if(!secret||token.length>600)return false;
 const [payload,signature,extra]=token.split('.');if(!payload||!signature||extra)return false;
 const expected=createHmac('sha256',secret).update('judge:'+payload).digest('base64url');
 if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return false;
 try{const data=JSON.parse(Buffer.from(payload,'base64url').toString());return typeof data.expires==='number'&&data.expires>now&&data.expires<=now+8*24*60*60*1000;}catch{return false;}
}
export function judgeCookie(header:string|undefined){
 return (header||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('muse_judge='))?.slice('muse_judge='.length)||'';
}

