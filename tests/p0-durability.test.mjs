import {test} from 'node:test';
import * as fs from 'node:fs';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {writeJson,readJson,contentHash} from '../server/durable-json.mjs';
import {ResultArchive} from '../server/result-archive.mjs';
import {LeadPilot} from '../server/pilot.mjs';
import {validateResponseRef} from '../src/orchestration/durability.ts';
const root=()=>{mkdirSync('work/p0-validation/durability',{recursive:true});return mkdtempSync(resolve('work/p0-validation/durability/case-'));};
test('temporary creation collision never removes bytes created by another writer',()=>{
 const dir=root(),file=resolve(dir,'book.json');let collision;
 const injected={...fs,writeFileSync(path,...args){collision=path;fs.writeFileSync(path,'foreign bytes');throw Object.assign(Error('collision'),{code:'EEXIST'});}};
 assert.throws(()=>writeJson(file,{version:1},{fs:injected}),e=>e.code==='STORE_IO');assert.equal(readFileSync(collision,'utf8'),'foreign bytes');
});
for(let seed=1;seed<=10;seed++)test('S23 durable publication failure seed '+seed,()=>{
 const dir=root(),file=resolve(dir,'state.json'),one=writeJson(file,{n:1});assert.throws(()=>writeJson(file,{n:2},{expectedHash:one.hash,failpoint:p=>{if(p==='after_flush')throw Error('injected');}}),e=>e.code==='STORE_IO'&&e.outcome==='not_committed');assert.deepEqual(readJson(file).value,{n:1});assert.throws(()=>writeJson(file,{n:2},{expectedHash:one.hash,failpoint:p=>{if(p==='after_publish')throw Error('injected');}}),e=>e.outcome==='unknown');assert.deepEqual(readJson(file).value,{n:2});assert.throws(()=>writeJson(file,{n:3},{expectedHash:one.hash}),e=>e.code==='STORE_CONFLICT');assert.deepEqual(readJson(file).value,{n:2});assert(readdirSync(dir).every(p=>!p.endsWith('.tmp')));
});
test('immutable artifact cannot be replaced and invalid snapshot is preserved',()=>{
 const dir=root(),file=resolve(dir,'artifact.json');writeJson(file,{id:1},{immutable:true});assert.throws(()=>writeJson(file,{id:2},{immutable:true}),e=>e.code==='ARTIFACT_EXISTS');writeFileSync(file,'broken');assert.throws(()=>readJson(file),e=>e.code==='STORE_INVALID');assert.equal(readFileSync(file,'utf8'),'broken');assert.throws(()=>writeJson(file,{id:3},{validate:()=>{throw Error('invalid');}}));assert.equal(readFileSync(file,'utf8'),'broken');
});
for(let seed=1;seed<=10;seed++)test('S22 terminal archive before workflow tick seed '+seed,()=>{
 const dir=root(),archive=new ResultArchive(dir,'office-demo',dir),task={id:'ui',agentId:'frontend',projectId:'office-demo',executionId:'wf-p0-ui-1'},pilot=new LeadPilot({root:dir,agentId:'frontend'});Object.assign(pilot.state,{taskId:task.executionId,threadId:'thread-p0',turnId:'turn-one'});pilot.outputSinks=new Map([[task.executionId,(text,turn)=>{const row=archive.put(task,text,'thread-p0',turn);return {response:row.response,ref:archive.ref(row)};}]]);
 const first='safe evidence '.repeat(4000);pilot.notification({method:'item/completed',params:{threadId:'thread-p0',turnId:'turn-one',item:{type:'agentMessage',phase:'final_answer',text:first}}});const ref=structuredClone(pilot.state.responseRef);validateResponseRef(ref);assert.equal(archive.get(task,ref).response,first);assert.equal(pilot.state.result,first);pilot.notification({method:'turn/started',params:{threadId:'thread-p0',turn:{id:'turn-two'}}});pilot.notification({method:'item/completed',params:{threadId:'thread-p0',turnId:'turn-two',item:{type:'agentMessage',phase:'final_answer',text:'second result'}}});assert.notEqual(pilot.state.responseRef.artifactId,ref.artifactId);assert.equal(archive.get(task,ref).response,first);assert.equal(archive.get(task,pilot.state.responseRef).response,'second result');assert.throws(()=>archive.get(task,{...ref,executionId:'foreign'}));
});
test('oversize and secret outputs are explicitly incomplete/redacted, never falsely complete',()=>{
 const dir=root(),archive=new ResultArchive(dir,'office-demo',dir),t={id:'ui',agentId:'frontend',projectId:'office-demo',executionId:'wf-p0-ui-1'},large=archive.put(t,'x'.repeat(128001),'thread','large');assert.equal(large.contentStatus,'truncated');assert.equal(large.response.length,128000);const secret='api_key=sk-test-secret-value-that-must-not-leak',redacted=archive.put(t,secret,'thread','secret');assert.equal(redacted.contentStatus,'redacted');assert(!redacted.response.includes('sk-test-secret'));assert.notEqual(contentHash(secret),redacted.sha256);
});
test('failed response persistence retains safe text and its incompleteness through explicit reconciliation',()=>{
 const dir=root(),archive=new ResultArchive(dir,'office-demo',dir),t={id:'ui',agentId:'frontend',projectId:'office-demo',executionId:'wf-p0-safe-1'},pilot=new LeadPilot({root:dir,agentId:'frontend'});let unavailable=true;
 Object.assign(pilot.state,{taskId:t.executionId,threadId:'thread',turnId:'turn',execution:'completed'});
 pilot.outputSinks=new Map([[t.executionId,(text,turn,status)=>{if(unavailable)throw Error('disk unavailable');const row=archive.put(t,text,'thread',turn,status);return {response:row.response,ref:archive.ref(row)}; }]]);
 pilot.captureResponse('api_key=sk-test-secret-value-that-must-not-leak');assert(pilot.state.responsePersistenceError);assert(!JSON.stringify(pilot.state).includes('sk-test-secret'));assert(!JSON.stringify(pilot.pendingResponse).includes('sk-test-secret'));assert.throws(()=>pilot.reconcileResponse());
 unavailable=false;pilot.reconcileResponse();assert.equal(pilot.state.responsePersistenceError,null);assert.equal(pilot.state.responseRef.contentStatus,'redacted');assert.equal(archive.get(t,pilot.state.responseRef).contentStatus,'redacted');assert.equal(pilot.pendingResponse,null);
});
