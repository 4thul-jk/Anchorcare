import {randomUUID} from 'node:crypto';import {ApiError} from '../engram-retrieval/src/validation.js';
export class DeviceLocation{
 constructor(private service:any){}
 async save(patient:string,input:any){
  if(input.consent!==true)throw new ApiError(400,'Location sharing needs explicit consent');
  const {latitude,longitude,accuracy}=input;
  if(typeof latitude!=='number'||!Number.isFinite(latitude)||Math.abs(latitude)>90||typeof longitude!=='number'||!Number.isFinite(longitude)||Math.abs(longitude)>180||typeof accuracy!=='number'||!Number.isFinite(accuracy)||accuracy<0||accuracy>100000)throw new ApiError(400,'Invalid device coordinates');
  const now=this.service.clock(),capturedAt=new Date(input.captured_at);if(!Number.isFinite(+capturedAt)||+capturedAt>+now+30000||+now-+capturedAt>300000)throw new ApiError(400,'Please request a fresh device location');
  const row={_id:'geo_'+randomUUID(),...this.service.scope(patient),latitude,longitude,accuracy,capturedAt,recordedAt:now,source:'browser_geolocation',consent:true};await this.service.store.insert('agent_device_locations',row);return this.public(row,now);
 }
 private public(row:any,now:Date){return {latitude:row.latitude,longitude:row.longitude,accuracy:row.accuracy,capturedAt:row.capturedAt,recordedAt:row.recordedAt,fresh:+now-+new Date(row.capturedAt)<=300000,source:'browser_geolocation',mapUrl:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(row.latitude+','+row.longitude),interpretation:'Device-reported position, not proof the patient is with the device.'};}
 async latest(patient:string){const row=(await this.service.store.list('agent_device_locations',this.service.scope(patient),{capturedAt:-1},1))[0];return row?this.public(row,this.service.clock()):null;}
}
