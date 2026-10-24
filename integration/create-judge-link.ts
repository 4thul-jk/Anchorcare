import dotenv from 'dotenv';import {writeFileSync,mkdirSync} from 'node:fs';import {judgeInvite} from './judge-access';
dotenv.config({quiet:true});
const secret=process.env.ANCHORCARE_COMPANION_KEY;if(!secret)throw Error('Configure the private companion key first');
const origin='https://muse-anchorcare-demo.onrender.com';
mkdirSync('tmp',{recursive:true});
writeFileSync('tmp/JUDGE-DEMO-LINK.txt',`${origin}/#judge=${judgeInvite(secret)}\n\nPrivate judge invitation: expires in 24 hours. Anyone with this link can use the shared fictional workspace. Do not enter real personal information. External calls are not connected. Render may take a minute to wake after inactivity.\n`);
console.log('Private invitation written to tmp/JUDGE-DEMO-LINK.txt (not printed or committed).');
