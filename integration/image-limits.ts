import {ApiError} from '../engram-retrieval/src/validation.js';
export function checkImagePixels(bytes:Buffer,type:string){
 let width=0,height=0;
 if(type==='image/png'&&bytes.length>=24&&bytes.toString('ascii',12,16)==='IHDR'){width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
 if(type==='image/jpeg'){
  let offset=2;
  while(offset+3<bytes.length){
   if(bytes[offset++]!==255)break;while(bytes[offset]===255)offset++;
   const marker=bytes[offset++];if(marker===0xda||marker===0xd9)break;
   if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
   if(offset+2>bytes.length)break;const length=bytes.readUInt16BE(offset);
   if(length<2||offset+length>bytes.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8){height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);break;}
   offset+=length;
  }
 }
 if(type==='image/webp'){
  let offset=12;
  while(offset+8<=bytes.length){
   const tag=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),data=offset+8;
   if(data+size>bytes.length)break;
   if(tag==='VP8X'&&size>=10){if(bytes[data]&2)throw new ApiError(400,'Animated pictures are not supported');width=1+bytes.readUIntLE(data+4,3);height=1+bytes.readUIntLE(data+7,3);break;}
   if(tag==='VP8L'&&size>=5&&bytes[data]===0x2f){const bits=bytes.readUInt32LE(data+1);width=1+(bits&0x3fff);height=1+((bits>>>14)&0x3fff);break;}
   if(tag==='VP8 '&&size>=10&&bytes.subarray(data+3,data+6).equals(Buffer.from([0x9d,1,0x2a]))){width=bytes.readUInt16LE(data+6)&0x3fff;height=bytes.readUInt16LE(data+8)&0x3fff;break;}
   offset=data+size+(size%2);
  }
 }
 if(!width||!height||width*height>16000000||width>16000||height>16000)throw new ApiError(400,'Invalid or oversized image dimensions');
}
