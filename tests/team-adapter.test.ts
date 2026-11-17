import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyRuntime,projectRuntime,RealCodexAdapter} from '../src/integration/RealCodexAdapter.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MemoryCheckpointStorage} from '../src/checkpoints/model.ts';
import {createOffice} from '../src/state/office.ts';
import type {RuntimeSnapshot} from '../src/integration/runtime.ts';
test('team projection associates eight runtime states, tasks and events with the correct employee',()=>{
 const members=Object.fromEntries(createOffice().agents.map((a,i)=>[a.id,{...emptyRuntime(),agentId:a.id,role:a.role,connection:'connected' as const,execution:i===2?'paused' as const:'working' as const,startedAt:'2026-11-15T10:00:00Z',taskId:`task-${a.id}`,events:[{id:`event-${a.id}`,agentId:a.id,taskId:`task-${a.id}`,method:'turn/started',message:a.role,timestamp:'2026-11-15T10:00:00Z',source:'codex' as const,threadId:`thread-${a.id}`,turnId:'turn',execution:'working' as const,taskStartedAt:'2026-11-15T10:00:00Z'}]}]));
 const state=projectRuntime({...members.lead,members});assert.equal(state.agents.length,8);assert.equal(state.tasks.length,8);assert.equal(state.activity.length,8);
 for(const agent of state.agents){assert.equal(agent.currentTask,`task-${agent.id}`);assert.equal(state.tasks.find(t=>t.id===agent.currentTask)?.assignedAgent,agent.id);assert.equal(state.activity.find(e=>e.agentId===agent.id)?.taskId,agent.currentTask);}
 assert.equal(state.tasks.find(t=>t.assignedAgent==='frontend')?.status,'paused');assert.equal(state.agents[2].status,'waiting');
});
test('team event notifications are delivered once and transport loss marks every connection unavailable',async()=>{
 const member={...emptyRuntime(),agentId:'qa',connection:'connected' as const,events:[{id:'qa-event',method:'runtime/connected',message:'QA',timestamp:new Date().toISOString(),source:'codex' as const,threadId:null,turnId:null,execution:'idle' as const,taskStartedAt:null}]};
 let fail=false;const snapshot:RuntimeSnapshot={...emptyRuntime(),members:{qa:member}};const adapter=new RealCodexAdapter({snapshot:async()=>{if(fail)throw new Error('offline');return snapshot;},action:async()=>snapshot});
 const events:string[]=[];adapter.subscribeToEvents(e=>events.push(e.id));await adapter.refresh();await adapter.refresh();assert.deepEqual(events,['qa-event']);fail=true;await adapter.refresh();assert.equal(adapter.getRuntime().members?.qa.connection,'error');
});
test('mock connects eight sessions and runs them under the conservative resource budget, preserves every employee checkpoint after restart',async()=>{
 const storage=new MemoryCheckpointStorage(),mock=new MockCodexAdapter(storage);await mock.action('connect_all');
 for(const agent of mock.getAgents()){await mock.action('start',{agentId:agent.id});await mock.action('pause',{agentId:agent.id});}await mock.action('resume',{agentId:'frontend'});await mock.action('resume',{agentId:'backend'});
 const runtime=mock.getRuntime();assert.equal(Object.values(runtime.members!).filter(r=>r.connection==='connected').length,8);assert.equal(new Set(Object.values(runtime.members!).map(r=>r.threadId)).size,8);assert.equal(mock.getTasks().length,8);assert.ok(mock.getEvents().every(e=>e.source==='mock'));
 const frontend=mock.getAgents().find(a=>a.id==='frontend')!;await mock.action('mock_step',{agentId:'frontend'});await mock.action('pause',{agentId:'frontend'});assert.equal(mock.getRuntime().members?.backend.execution,'working');assert.equal(mock.getTasks().find(t=>t.id===frontend.currentTask)?.progress,25);
 for(const a of mock.getAgents().filter(a=>mock.getRuntime().members?.[a.id].execution==='working'))await mock.action('pause',{agentId:a.id});
 const restored=new MockCodexAdapter(storage);assert.equal(restored.getTasks().filter(t=>t.status==='paused').length,8);
 await assert.rejects(restored.action('resume',{agentId:'backend',taskId:frontend.currentTask!}),/another employee/);await restored.action('resume',{agentId:'frontend'});assert.equal(restored.getRuntime().members?.frontend.execution,'working');assert.equal(restored.getRuntime().members?.backend.execution,'paused');assert.equal(restored.getTasks().find(t=>t.id===frontend.currentTask)?.progress,25);
 await restored.action('mock_error',{agentId:'frontend'});assert.equal(restored.getRuntime().members?.frontend.execution,'error');restored.stop();mock.stop();
});
