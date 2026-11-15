import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve,relative } from 'node:path';
import { mkdirSync,mkdtempSync,rmSync,readFileSync,writeFileSync } from 'node:fs';
import { CheckpointPilot,limitInfo } from '../server/checkpoint-pilot.mjs';
import { FileCheckpointStorage } from '../server/checkpoint-store.mjs';
import { loadLead,loadContext } from '../server/pilot.mjs';
import { MemoryCheckpointStorage,validateBook,latestCheckpoint,safeText } from '../src/checkpoints/model.ts';
const root = resolve('.'), lead = loadLead(root), context = loadContext(root);
function fixture(storage = new MemoryCheckpointStorage('codex')) {
  const rpc = { requests:[],closed:false,n:0,thread:'thread-1',async open(){this.closed=false;},close(){this.closed=true;this.onExit?.();},respond(){},reject(){},
    async request(method,params) {
      this.requests.push({method,params});
      if (method==='account/read') return {account:{type:'chatgpt'}};
      if (method==='skills/list') return {data:[{skills:lead.skills.map(s=>({...s,enabled:true}))}]};
      if (method==='thread/start' || method==='thread/resume') return {thread:{id:this.thread,status:{type:'idle'}},sandbox:{type:'readOnly',networkAccess:false},approvalPolicy:'on-request',approvalsReviewer:'user'};
      if (method==='turn/start') { const id=`turn-${++this.n}`; this.onNotification({method:'turn/started',params:{threadId:this.thread,turn:{id,status:'inProgress'}}});return {turn:{id}}; }
      return {};
    } };
  const pilot = new CheckpointPilot({root,storage,makeRpc:()=>rpc,detect:async()=>({available:true,version:'codex-cli 0.144.5'}),load:()=>structuredClone(lead),context:()=>structuredClone(context)});
  const notify=(method,extra={})=>rpc.onNotification({method,params:{threadId:rpc.thread,turnId:pilot.state.turnId,...extra}});
  const complete=(status='interrupted',error)=>notify('turn/completed',{turn:{id:pilot.state.turnId,status,error}});
  const start=async()=>{await pilot.connect();await pilot.start();notify('turn/plan/updated',{plan:[{step:'Read approved context',status:'completed'},{step:'Finish structured plan',status:'inProgress'}]});notify('item/completed',{item:{type:'agentMessage',phase:'commentary',text:'Director decision: keep read-only; final plan remains.'}});};
  return {pilot,rpc,storage,notify,complete,start};
}
test('A manual pause waits for confirmed interruption then resumes the SAME task and original thread',async()=>{
  const f=fixture();await f.start();const id=f.pilot.state.taskId;
  await f.pilot.pause();assert.equal(f.pilot.state.execution,'pausing');assert.equal(f.pilot.book.checkpoints.at(-1).resumable,false);
  f.complete();const cp=latestCheckpoint(f.pilot.book);assert.equal(cp.reason,'user_pause');assert.deepEqual(cp.completedWork,['Read approved context']);assert.deepEqual(cp.remainingWork,['Finish structured plan']);assert.ok(cp.lastKnownState.workNotes.length);assert.equal(cp.lastKnownState.stopConfirmed,true);
  await f.pilot.resume();assert.equal(f.pilot.state.taskId,id);assert.equal(f.pilot.state.execution,'working');assert.equal(f.pilot.state.resumeMode,'original_thread');
  assert.equal(f.rpc.requests.find(r=>r.method==='thread/start').params.ephemeral,false);
  const request=f.rpc.requests.filter(r=>r.method==='turn/start').at(-1);assert.match(request.params.input[0].text,/do not repeat|Do not repeat/);assert.match(request.params.input[0].text,/Read approved context/);assert.match(request.params.input[0].text,/Finish structured plan/);
  assert.deepEqual(request.params.sandboxPolicy,{type:'readOnly',networkAccess:false});
  assert.ok(f.pilot.state.events.some(e=>e.method==='task_resumed'));assert.ok(f.pilot.state.events.every(e=>e.timestamp));
});
test('B only verified terminal usage/session/context or 429 codes pause without failed/completed task',async()=>{
  for(const info of ['usageLimitExceeded','sessionBudgetExceeded','contextWindowExceeded',{httpConnectionFailed:{httpStatusCode:429}}]) {
    const f=fixture();await f.start();f.notify('error',{error:{codexErrorInfo:info,message:'Not persisted'},willRetry:false});
    assert.equal(f.pilot.state.execution,'pausing');f.complete('failed',{codexErrorInfo:info,message:'Limit'});
    assert.equal(f.pilot.state.execution,'paused');assert.equal(f.pilot.book.tasks[0].status,'paused');assert.equal(f.pilot.state.completedAt,null);assert.equal(latestCheckpoint(f.pilot.book).reason,'limit_reached');
    assert.equal(f.pilot.state.events.filter(e=>e.method==='task_paused_limit').length,1);
    await f.pilot.resume();assert.equal(f.pilot.state.execution,'working');
  }
});
test('retrying, arbitrary text, timeout, generic 500 and inactivity never become a limit',async()=>{
  for(const error of [{message:'rate limit token quota'},{codexErrorInfo:'serverOverloaded'},{codexErrorInfo:{httpConnectionFailed:{httpStatusCode:500}}}])assert.equal(limitInfo(error),null);
  const f=fixture();await f.start();f.notify('error',{error:{codexErrorInfo:'usageLimitExceeded'},willRetry:true});assert.equal(f.pilot.state.execution,'working');
  f.rpc.onExit();assert.equal(latestCheckpoint(f.pilot.book).reason,'connection_lost');assert.ok(!f.pilot.state.events.some(e=>e.method==='task_paused_limit'));
});
test('a confirmed limit signal remains a limit checkpoint if the connection closes before terminal confirmation',async()=>{
  const f=fixture();await f.start();f.notify('error',{error:{codexErrorInfo:'usageLimitExceeded'},willRetry:false});f.pilot.disconnect();
  assert.equal(f.pilot.state.execution,'paused');assert.equal(latestCheckpoint(f.pilot.book).reason,'limit_reached');assert.equal(latestCheckpoint(f.pilot.book).lastKnownState.stopConfirmed,false);
});
test('C disconnect preserves association and context; reconnect plus resume restores it',async()=>{
  const f=fixture();await f.start();const task=f.pilot.state.taskId;f.pilot.disconnect();assert.equal(f.pilot.state.execution,'paused');assert.equal(f.pilot.state.connection,'disconnected');assert.equal(latestCheckpoint(f.pilot.book).reason,'connection_lost');
  await f.pilot.resume(task);assert.equal(f.pilot.state.taskId,task);assert.equal(f.pilot.state.connection,'connected');assert.equal(f.pilot.state.execution,'working');
});
test('D checkpoint remains across application restart and does not automatically execute',async()=>{
  const first=fixture();await first.start();await first.pilot.pause();first.complete();const id=first.pilot.state.taskId;
  const second=fixture(first.storage);assert.equal(second.pilot.state.execution,'paused');assert.equal(second.rpc.requests.length,0);assert.equal(second.pilot.state.taskId,id);
  await second.pilot.resume();assert.equal(second.pilot.state.execution,'working');
});
test('rolling checkpoint recovers unexpected process death; manual checkpoint is not resumable while task runs',async()=>{
  const f=fixture();await f.start();f.pilot.checkpoint();assert.equal(f.pilot.book.checkpoints.at(-1).resumable,false);
  const restart=fixture(f.storage);assert.equal(restart.pilot.state.execution,'paused');assert.equal(latestCheckpoint(restart.pilot.book).reason,'connection_lost');assert.equal(latestCheckpoint(restart.pilot.book).lastKnownState.stopConfirmed,false);
});
test('E completed tasks close every checkpoint and never appear resumable, including after restart',async()=>{
  const f=fixture();await f.start();f.complete('completed');assert.equal(f.pilot.state.execution,'completed');assert.ok(f.pilot.book.checkpoints.every(c=>c.status==='completed'&&!c.resumable));assert.throws(()=>latestCheckpoint(f.pilot.book));
  const restored=fixture(f.storage);assert.equal(restored.pilot.state.execution,'idle');await assert.rejects(restored.pilot.resume(),/Нет задачи/);
});
test('completion winning a pause race is never demoted to paused',async()=>{
  const f=fixture();await f.start();await f.pilot.pause();f.complete('completed');assert.equal(f.pilot.state.execution,'completed');assert.ok(f.pilot.book.checkpoints.every(c=>!c.resumable));
});
test('healthy runtime rejection of thread restore uses checkpoint continuation, not original prompt from zero',async()=>{
  const f=fixture();await f.start();await f.pilot.pause();f.complete();const original=f.rpc.request.bind(f.rpc);
  f.rpc.request=(m,p)=>m==='thread/resume'?Promise.reject(Object.assign(new Error('Codex rejected request (-32600)'),{code:-32600})):original(m,p);
  await f.pilot.resume();assert.equal(f.pilot.state.resumeMode,'checkpoint_continuation');assert.equal(f.rpc.requests.filter(r=>r.method==='thread/start').length,2);
  assert.match(f.rpc.requests.filter(r=>r.method==='turn/start').at(-1).params.input[0].text,/completedWork/);
});
test('transport timeout does not invent missing thread or trigger new work; checkpoint remains',async()=>{
  const f=fixture();await f.start();await f.pilot.pause();f.complete();const original=f.rpc.request.bind(f.rpc);
  f.rpc.request=(m,p)=>m==='thread/resume'?Promise.reject(new Error('timeout')):original(m,p);
  await assert.rejects(f.pilot.resume());assert.equal(f.rpc.requests.filter(r=>r.method==='thread/start').length,1);assert.equal(f.pilot.book.tasks[0].status,'paused');assert.ok(f.pilot.state.events.some(e=>e.method==='resume_failed'));
});
test('a lost start response after a resumed turn starts preserves the newest work for a retry',async()=>{
  const f=fixture();await f.start();await f.pilot.pause();f.complete();const original=f.rpc.request.bind(f.rpc);
  f.rpc.request=async(m,p)=>{const result=await original(m,p);if(m==='turn/start')throw new Error('response lost');return result;};
  await assert.rejects(f.pilot.resume());assert.equal(f.pilot.state.execution,'paused');assert.ok(latestCheckpoint(f.pilot.book).resumable);assert.equal(latestCheckpoint(f.pilot.book).reason,'connection_lost');
});
test('verified completion is never rolled back by a lost resume response',async()=>{
  const f=fixture();await f.start();await f.pilot.pause();f.complete();const original=f.rpc.request.bind(f.rpc);
  f.rpc.request=async(m,p)=>{const result=await original(m,p);if(m==='turn/start'){f.complete('completed');throw new Error('response lost');}return result;};
  await f.pilot.resume();assert.equal(f.pilot.state.execution,'completed');assert.equal(f.pilot.book.tasks[0].status,'completed');assert.throws(()=>latestCheckpoint(f.pilot.book));
});
test('restoration cannot widen permissions and active original threads cannot receive duplicate turns',async()=>{
  for(const unsafe of ['sandbox','active']){
    const f=fixture();await f.start();await f.pilot.pause();f.complete();const original=f.rpc.request.bind(f.rpc);
    f.rpc.request=async(m,p)=>{const r=await original(m,p);if(m==='thread/resume'){if(unsafe==='sandbox')r.sandbox.type='dangerFullAccess';else r.thread.status.type='active';}return r;};
    await assert.rejects(f.pilot.resume());assert.equal(f.rpc.requests.filter(r=>r.method==='turn/start').length,1);
  }
});
test('ambiguous natural resume requires selection; wrong task, agent, injected fields or credential values are rejected',async()=>{
  const f=fixture();await f.start();await f.pilot.pause();f.complete();const book=f.storage.load();const other=structuredClone(book.tasks[0]);other.id='other-task';book.tasks.push(other);const cp=structuredClone(book.checkpoints.at(-1));cp.id='other-cp';cp.taskId=other.id;book.checkpoints.push(cp);
  assert.throws(()=>latestCheckpoint(validateBook(book,'codex')),/Выберите задачу/);assert.equal(latestCheckpoint(book,other.id).id,'other-cp');
  for(const mutate of [b=>b.tasks.splice(0,1),b=>b.checkpoints[0].agentId='backend',b=>b.checkpoints[0].apiKey='secret',b=>b.checkpoints[0].importantDecisions.push('password=private-value'),b=>b.checkpoints[0].relevantFiles[0].path='../../auth.json']) {const bad=structuredClone(f.storage.load());mutate(bad);assert.throws(()=>validateBook(bad,'codex'));}
});
test('sensitive model notes are redacted before checkpoint persistence',async()=>{
  const f=fixture();await f.start();const secret='sk-'+'a'.repeat(35);f.notify('item/completed',{item:{type:'agentMessage',phase:'commentary',text:`Decision. API_KEY=${secret}; password=hunter-secret; Bearer abc123`}});await f.pilot.pause();f.complete();
  const data=JSON.stringify(f.storage.load());assert.ok(!data.includes(secret)&&!data.includes('hunter-secret')&&!data.includes('abc123'));assert.match(data,/REDACTED/);assert.equal(safeText('A useful decision'),'A useful decision');
});
test('atomic JSON persistence survives a fresh store; corrupt data is not silently overwritten',async t=>{
  const base=resolve(root,'work/checkpoint-tests');mkdirSync(base,{recursive:true});const dir=mkdtempSync(resolve(base,'fixture-'));assert.ok(!relative(base,dir).startsWith('..'));
  t.after(()=>{assert.ok(!relative(base,dir).startsWith('..'));rmSync(dir,{recursive:true,force:true});});
  const store=new FileCheckpointStorage(dir);const f=fixture(store);await f.start();await f.pilot.pause();f.complete();assert.equal(new FileCheckpointStorage(dir).load().checkpoints.at(-1).reason,'user_pause');
  const unlock=store.acquireLock();assert.throws(()=>new FileCheckpointStorage(dir).acquireLock(),/Another bridge/);unlock();const secondUnlock=new FileCheckpointStorage(dir).acquireLock();secondUnlock();
  writeFileSync(store.file,'{"invalid":true}');const corrupted=fixture(new FileCheckpointStorage(dir));assert.ok(corrupted.pilot.state.recoveryError);await assert.rejects(corrupted.pilot.start());assert.equal(readFileSync(store.file,'utf8'),'{"invalid":true}');
});
