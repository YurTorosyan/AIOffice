import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LocalBridgeTransport} from '../src/integration/runtime.ts';
import {RealCodexAdapter} from '../src/integration/RealCodexAdapter.ts';
import {WorkflowClient} from '../src/orchestration/WorkflowClient.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
test('stopping an observer aborts its old-project HTTP snapshot without reporting a connection failure',async()=>{
 let signal:AbortSignal|undefined;const request=(async(_url:unknown,options:RequestInit)=>{signal=options.signal as AbortSignal;return new Promise<Response>((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError'))));}) as typeof fetch;
 const adapter=new RealCodexAdapter(new LocalBridgeTransport(request));const refresh=adapter.refresh();adapter.stopObserving();await refresh;assert.equal(signal?.aborted,true);assert.equal(adapter.getRuntime().connection,'disconnected');assert.equal(adapter.getRuntime().error,null);
});
test('suspending workflow polling cancels its owned request and suppresses new requests until explicitly activated',async()=>{
 const original=globalThis.fetch,adapter=new MockCodexAdapter(),client=new WorkflowClient(adapter,undefined,false);let calls=0,signal:AbortSignal|undefined;
 globalThis.fetch=(async(_url:unknown,options:RequestInit)=>{calls++;signal=options.signal as AbortSignal;return new Promise<Response>((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError'))));}) as typeof fetch;
 try{const refresh=client.refresh('codex');client.suspend();await assert.rejects(refresh,{name:'AbortError'});assert(signal?.aborted);await client.refresh('codex');assert.equal(calls,1);assert.equal(client.snapshot('codex').workflows.length,0);client.activate();globalThis.fetch=(async(url:unknown)=>new Response(JSON.stringify(String(url).includes('workflows')?{version:1,source:'codex',projectId:'office-demo',workflows:[],events:[],recoveryError:null}:{version:1,records:[],events:[],available:false,error:null}))) as typeof fetch;await client.refresh('codex');assert.equal(client.snapshot('codex').projectId,'office-demo');}finally{client.suspend();adapter.stop();globalThis.fetch=original;}
});
