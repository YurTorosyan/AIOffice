import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {TeamActions} from '../../server/team-actions.mjs';
const [root,phase]=process.argv.slice(2);
const {w,t,a}=JSON.parse(readFileSync(resolve(root,'fixture.json'),'utf8'));
const actions=new TeamActions(root,{failpoint:point=>{if(point===phase)process.exit(73);}});
await actions.approve(w,t,a);
throw Error('Requested crash point was not reached');
