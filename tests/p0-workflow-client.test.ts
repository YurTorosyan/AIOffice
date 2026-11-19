import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkflowClient} from '../src/orchestration/WorkflowClient.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {emptyWorkflows} from '../src/orchestration/model.ts';
const snapshot={projectId:'office-demo',...emptyWorkflows('codex'),recoveryError:null,lastSavedAt:null};
test('malformed successful HTTP snapshot cannot replace the last validated project state',async()=>{
 const original=globalThis.fetch,adapter=new MockCodexAdapter(),client=new WorkflowClient(adapter,undefined,false);
 try{globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('/security/')?{available:false}:snapshot));await client.refresh('codex');const before=client.snapshot('codex');globalThis.fetch=async()=>new Response(JSON.stringify({...snapshot,version:999}));await assert.rejects(client.refresh('codex'),/Invalid workflow store/);assert.deepEqual(client.snapshot('codex').workflows,before.workflows);assert.equal(client.snapshot('codex').transport!.lastReceivedAt,before.transport!.lastReceivedAt);assert(client.snapshot('codex').transport!.error);}
 finally{globalThis.fetch=original;adapter.stop();}
});
test('lost command response triggers read-only refresh and preserves request identity for explicit retry',async()=>{
 const original=globalThis.fetch,adapter=new MockCodexAdapter(),client=new WorkflowClient(adapter,undefined,false),posts:{headers:Record<string,string>}[]=[];let fail=true,gets=0;
 globalThis.fetch=async(url,options)=>{const path=String(url);if(path.includes('/session'))return new Response(JSON.stringify({token:'fixture-token'}));if(options?.method==='POST'){posts.push({headers:options.headers as Record<string,string>});if(fail){fail=false;throw Error('response lost after server effect');}return new Response(JSON.stringify(snapshot));}gets++;return new Response(JSON.stringify(path.includes('/security/')?{available:false}:snapshot));};
 try{await assert.rejects(client.command('codex','approve_action','flow',undefined,'approval'),/не повторялось/);assert.equal(posts.length,1);assert( gets>=1);assert(client.snapshot('codex').transport!.unknownCommand);await assert.rejects(client.command('codex','create','another','different'),/не отправлена/);assert.equal(posts.length,1);await client.command('codex','approve_action','flow',undefined,'approval');assert.equal(posts.length,2);assert.equal(posts[0].headers['X-AI-Office-Request-Id'],posts[1].headers['X-AI-Office-Request-Id']);assert.equal(client.snapshot('codex').transport!.unknownCommand,null);
 }finally{globalThis.fetch=original;adapter.stop();}
});
test('offline refresh keeps last snapshot explicitly stale and foreign responses never replace it',async()=>{
 const original=globalThis.fetch,adapter=new MockCodexAdapter(),client=new WorkflowClient(adapter,undefined,false);let offline=false;globalThis.fetch=async(url,options)=>{if(offline)throw Error('offline');if(String(url).includes('/session'))return new Response(JSON.stringify({token:'fixture'}));return new Response(JSON.stringify(options?.method==='POST'?{...snapshot,projectId:'foreign'}:snapshot));};
 try{await client.refresh('codex');const received=client.snapshot('codex').transport!.lastReceivedAt;assert(received);offline=true;await assert.rejects(client.refresh('codex'));assert.equal(client.snapshot('codex').transport!.lastReceivedAt,received);assert(client.snapshot('codex').transport!.error);offline=false;await assert.rejects(client.command('codex','pause','flow'),/другого проекта/);assert.equal(client.snapshot('codex').projectId,'office-demo');
 }finally{globalThis.fetch=original;adapter.stop();}
});
