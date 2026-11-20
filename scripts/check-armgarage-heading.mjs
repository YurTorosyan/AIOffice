// Synthetic heading regression only. Uses the existing pinned isolated QA image.
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {docker} from '../server/qa-executor.mjs';
import {webContainerArgs} from '../server/qa-web.mjs';
import {webRegistration} from '../server/qa-web-profiles.mjs';

const name='ai-office-web-qa-'+randomUUID(),image=webRegistration('armgarage').image;
const args=webContainerArgs(name,'probe','armgarage');
args.splice(-2,2,'--entrypoint','/usr/local/bin/node',image,'--input-type=module');
try{
 const result=await docker(args,{input:readFileSync(new URL('../tests/browser/armgarage-heading.mjs',import.meta.url),'utf8'),timeoutMs:60000,maxOutput:200000});
 process.stdout.write(result.output);
 assert(!result.timedOut&&!result.limited,'Heading fixture exceeded its execution budget');
 assert.equal(result.code,0,'Isolated heading regression failed');
}finally{
 const cleanup=await docker(['rm','--force',name]);
 assert(cleanup.code===0||/No such container/.test(cleanup.output),'Heading fixture cleanup not confirmed');
}
