import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockCodexAdapter } from '../src/integration/MockCodexAdapter.ts';
import { MemoryCheckpointStorage, latestCheckpoint } from '../src/checkpoints/model.ts';
test('mock workflow pause/restart/resume keeps its actual step, progress and task identity',()=>{
  const storage=new MemoryCheckpointStorage();const first=new MockCodexAdapter(storage);first.startWorkflow();for(let i=0;i<3;i++)first.advanceWorkflow();
  const id=first.getTasks()[0].id;first.pauseTask();assert.equal(first.getTasks()[0].status,'paused');assert.equal(first.getTasks()[0].progress,35);assert.equal(first.getCheckpoints().at(-1)!.lastKnownState.workflowStep,3);
  const next=new MockCodexAdapter(storage);assert.equal(next.getTasks()[0].status,'paused');next.start();assert.equal(next.getWorkflow().status,'paused');
  assert.equal(next.getTasks()[0].priority,'high');assert.equal(next.getTasks()[0].createdAt,first.getTasks()[0].createdAt);
  next.controlTask('Продолжим работу');next.stop();assert.equal(next.getTasks()[0].id,id);assert.equal(next.getTasks()[0].progress,35);
  next.start();for(let i=0;i<5;i++)next.advanceWorkflow();next.stop();assert.equal(next.getTasks()[0].status,'completed');assert.ok(next.getCheckpoints().every(c=>!c.resumable));assert.ok(next.getEvents().every(e=>e.source==='mock'));
});
test('mock verified-condition simulation is clearly mock and never claims a real rate limit',()=>{
  const mock=new MockCodexAdapter();mock.startWorkflow();mock.advanceWorkflow();mock.advanceWorkflow();mock.pauseTask(undefined,'limit_reached');
  assert.equal(mock.getTasks()[0].status,'paused');assert.equal(mock.getCheckpoints().at(-1)!.reason,'limit_reached');assert.ok(mock.getEvents().some(e=>e.type==='task_paused_limit'&&e.source==='mock'));
  mock.resumeTask();mock.stop();assert.equal(mock.getTasks()[0].status,'in_progress');
});
test('manual mock checkpoint contains more than a message, and secret-looking task text is not persisted',()=>{
  const storage=new MemoryCheckpointStorage();const mock=new MockCodexAdapter(storage);const id=mock.dispatch({type:'create',title:'Plan',description:'password=private-secret',priority:'normal'})!;
  mock.dispatch({type:'assign',taskId:id,agentId:'lead'});mock.dispatch({type:'transition',taskId:id,status:'in_progress'});mock.pauseTask(id);
  const book=storage.load();assert.ok(!JSON.stringify(book).includes('private-secret'));const cp=latestCheckpoint(book);assert.equal(cp.agentId,'lead');assert.ok(cp.taskDescription&&cp.remainingWork.length&&cp.lastKnownState);
});
