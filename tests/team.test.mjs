import {capabilities} from '../src/orchestration/model.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {TeamRuntime} from '../server/team.mjs';
import {employees,loadEmployee} from '../server/employee-config.mjs';
import {EmployeeCheckpointStorage} from '../server/team-store.mjs';
import {MemoryCheckpointStorage,validateBook} from '../src/checkpoints/model.ts';
const root=resolve('.');
function fixture({storage=new MemoryCheckpointStorage('codex'),maxActive=2}={}){
 const rpcs=new Map();
 const team=new TeamRuntime({root,storage,maxActive,detect:async()=>({available:true,version:'codex-cli 0.144.5'}),makeRpc:agentId=>{
  const rpc={requests:[],responses:[],closed:false,n:0,thread:`thread-${agentId}`,async open(){this.closed=false;},close(){this.closed=true;},respond(id,result){this.responses.push({id,result});},reject(id){this.responses.push({id,rejected:true});},async request(method,params){
   this.requests.push({method,params});
   if(method==='account/read')return {account:{type:'chatgpt'}};
   if(method==='skills/list')return {data:[{skills:loadEmployee(root,agentId).skills.map(s=>({...s,enabled:true}))}]};
   if(method==='thread/start'||method==='thread/resume')return {thread:{id:method==='thread/resume'?params.threadId:this.thread,status:{type:'idle'}},sandbox:{type:'readOnly',networkAccess:false},approvalPolicy:'on-request',approvalsReviewer:'user'};
   if(method==='turn/start'){const id=`turn-${agentId}-${++this.n}`;this.onNotification({method:'turn/started',params:{threadId:params.threadId,turn:{id,status:'inProgress'}}});return {turn:{id}};}
   return {};
  }};rpcs.set(agentId,rpc);return rpc;
 }});
 const notify=(id,method,params={})=>{const pilot=team.members.get(id);rpcs.get(id).onNotification({method,params:{threadId:pilot.state.threadId,turnId:pilot.state.turnId,...params}});};
 const complete=(id,status='completed',error)=>notify(id,'turn/completed',{turn:{id:team.members.get(id).state.turnId,status,error}});
 return {team,rpcs,storage,notify,complete};
}
test('all eight employees authenticate independently and discover exactly their installed assigned Skills',async()=>{
 const f=fixture();await f.team.action('connect_all');const states=f.team.snapshot().members;
 assert.equal(Object.keys(states).length,8);assert.equal(new Set(f.rpcs.values()).size,8);
 for(const e of employees){assert.equal(states[e.id].connection,'connected');assert.equal(states[e.id].agentId,e.id);assert.deepEqual(states[e.id].skills,e.skills);assert.equal(states[e.id].profile.path,`.codex/agents/${e.profile}.toml`);}
 f.team.disconnect();assert.ok([...f.rpcs.values()].every(r=>r.closed));
});
test('every role starts its own thread with exact profile, explicit skill inputs, bounded snapshots and read-only approvals',async()=>{
 const f=fixture();await f.team.action('connect_all');const threads=[];
 for(const e of employees){await f.team.action('start',{agentId:e.id});const rpc=f.rpcs.get(e.id),thread=rpc.requests.find(r=>r.method==='thread/start').params,turn=rpc.requests.find(r=>r.method==='turn/start').params;
  assert.ok(thread.developerInstructions.startsWith(loadEmployee(root,e.id).instructions));assert.match(thread.developerInstructions,new RegExp(`employee ${e.id}`));assert.equal(thread.sandbox,'read-only');assert.equal(thread.approvalPolicy,'on-request');assert.equal(thread.approvalsReviewer,'user');assert.equal(thread.ephemeral,false);assert.equal(thread.config['features.shell_tool'],false);assert.equal(thread.config['features.multi_agent'],false);assert.equal(thread.config.web_search,'disabled');
  const primary=Object.values(capabilities).find(c=>c.agentId===e.id).skill;assert.deepEqual(turn.input.filter(i=>i.type==='skill').map(s=>s.name),[primary]);assert.ok(!turn.input[0].text.split('REPOSITORY_SNAPSHOTS_JSON')[0].includes('attached Lead TOML')); assert.ok(turn.input[0].text.includes(`$${primary}`));for(const name of e.skills.filter(n=>n!==primary))assert.ok(!turn.input.some(i=>i.type==='skill'&&i.name===name));
  assert.deepEqual(turn.sandboxPolicy,{type:'readOnly',networkAccess:false});assert.equal(turn.threadId,`thread-${e.id}`);threads.push(turn.threadId);
  const snapshots=f.team.snapshot().members[e.id].contextFiles.map(p=>p.path);assert.ok(snapshots.includes(`.codex/agents/${e.profile}.toml`));assert.ok(!snapshots.some(p=>/auth\.json|\.env|recovery\.json/.test(p)));
  const checkpoint=f.team.snapshot().members[e.id].checkpoints.at(-1);assert.ok(checkpoint.importantDecisions[0].includes(`Employee ${e.id} (${e.role}) only`));assert.ok(!checkpoint.importantDecisions[0].includes('Lead only'));
  f.complete(e.id);
 }
 assert.equal(new Set(threads).size,8);assert.equal(f.storage.load().tasks.length,8);
});
test('two independent runs are bounded; foreign notifications and pausing one worker cannot affect another',async()=>{
 const f=fixture();await f.team.action('connect_all');await Promise.all([f.team.action('start',{agentId:'frontend'}),f.team.action('start',{agentId:'backend'})]);
 assert.deepEqual(new Set(f.team.snapshot().activeEmployees),new Set(['frontend','backend']));await assert.rejects(f.team.action('start',{agentId:'qa'}),/capacity/);
 f.notify('frontend','item/completed',{threadId:'thread-backend',item:{type:'agentMessage',phase:'final_answer',text:'foreign result'}});assert.equal(f.team.snapshot().members.frontend.result,'');
 await f.team.action('pause',{agentId:'frontend'});assert.equal(f.team.snapshot().members.backend.execution,'working');assert.equal(f.team.snapshot().activeEmployees.length,2);
 f.complete('frontend','interrupted');await f.team.action('start',{agentId:'qa'});assert.equal(f.team.snapshot().members.frontend.execution,'paused');assert.equal(f.team.snapshot().members.backend.execution,'working');
});
test('sequential fallback has one real execution slot and never pretends queued or parallel work exists',async()=>{
 const f=fixture({maxActive:1});await f.team.action('connect_all');await f.team.action('start',{agentId:'lead'});await assert.rejects(f.team.action('start',{agentId:'design'}),/capacity/);assert.equal(f.rpcs.get('design').requests.filter(r=>r.method==='turn/start').length,0);f.complete('lead');await f.team.action('start',{agentId:'design'});assert.equal(f.team.snapshot().members.design.execution,'working');
});
test('all eight owned checkpoints survive restart and resume the original task/thread with the same assigned Skills',async()=>{
 const f=fixture();await f.team.action('connect_all');const ids={};
 for(const e of employees){await f.team.action('start',{agentId:e.id});ids[e.id]=f.team.snapshot().members[e.id].taskId;await f.team.action('pause',{agentId:e.id});f.complete(e.id,'interrupted');}
 const book=f.storage.load();assert.equal(book.tasks.length,8);assert.equal(book.checkpoints.filter(c=>c.resumable).length,8);
 f.team.disconnect();const restored=fixture({storage:f.storage});
 for(const e of employees){const state=restored.team.snapshot().members[e.id];assert.equal(state.taskId,ids[e.id]);assert.equal(state.execution,'paused');assert.ok(state.checkpoints.every(c=>c.agentId===e.id));await restored.team.action('resume',{agentId:e.id,taskId:ids[e.id]});const next=restored.team.snapshot().members[e.id];assert.equal(next.taskId,ids[e.id]);assert.equal(next.threadId,`thread-${e.id}`);assert.equal(next.resumeMode,'original_thread');restored.complete(e.id);}
});
test('cross-employee resume/control and shared thread ownership are rejected before executing anything',async()=>{
 const f=fixture();await f.team.action('connect_all');await f.team.action('start',{agentId:'backend'});await f.team.action('pause',{agentId:'backend'});f.complete('backend','interrupted');const taskId=f.team.snapshot().members.backend.taskId;
 await assert.rejects(f.team.action('resume',{agentId:'qa',taskId}),/another employee/);await assert.rejects(f.team.action('control',{agentId:'qa',taskId,command:'resume'}),/another employee/);
 assert.equal(f.rpcs.get('qa').requests.filter(r=>r.method==='turn/start').length,0);
 const bad=structuredClone(f.storage.load()),task=structuredClone(bad.tasks[0]),cp=structuredClone(bad.checkpoints[0]);task.id='foreign-task';task.agentId='qa';cp.id='foreign-cp';cp.taskId=task.id;cp.agentId='qa';if(cp.resource){cp.resource.agentId='qa';cp.resource.taskId=task.id;}bad.tasks.push(task);bad.checkpoints.push(cp);assert.throws(()=>validateBook(bad,'codex'),/shared/);
 const scoped=new EmployeeCheckpointStorage(f.storage,'qa');assert.throws(()=>scoped.save(f.storage.load()),/owner/);
});
test('verified limits, disconnect recovery and denial-only approval handling remain isolated for each employee',async()=>{
 for(const e of employees){const f=fixture();await f.team.action('connect',{agentId:e.id});await f.team.action('start',{agentId:e.id});
  f.notify(e.id,'error',{error:{codexErrorInfo:'usageLimitExceeded'},willRetry:false});assert.equal(f.team.snapshot().members[e.id].execution,'pausing');f.complete(e.id,'failed',{codexErrorInfo:'usageLimitExceeded'});assert.equal(f.team.snapshot().members[e.id].execution,'paused');assert.equal(f.team.snapshot().members[e.id].pauseReason,'limit_reached');
  await f.team.action('resume',{agentId:e.id});const p=f.team.members.get(e.id),rpc=f.rpcs.get(e.id);rpc.onRequest({id:7,method:'item/permissions/requestApproval',params:{threadId:p.state.threadId}});assert.equal(p.state.execution,'waiting');await f.team.action('reject',{agentId:e.id});assert.deepEqual(rpc.responses.at(-1).result,{permissions:{},scope:'turn'});
  await f.team.action('disconnect',{agentId:e.id});assert.equal(p.state.execution,'paused');assert.equal(p.state.pauseReason,'connection_lost');assert.notEqual(p.state.completedAt,'completed');
 }
});
test('healthy restoration rejection creates a checkpoint continuation only in the correct employee context',async()=>{
 const f=fixture();await f.team.action('connect',{agentId:'security'});await f.team.action('start',{agentId:'security'});await f.team.action('pause',{agentId:'security'});f.complete('security','interrupted');const before=f.team.snapshot().members.security.taskId,rpc=f.rpcs.get('security'),original=rpc.request.bind(rpc);
 rpc.request=async(m,p)=>{if(m==='thread/resume')throw Object.assign(new Error('Rejected'),{code:-32602});if(m==='thread/start')rpc.thread='thread-security-continuation';return original(m,p);};
 await f.team.action('resume',{agentId:'security',taskId:before});assert.equal(f.team.snapshot().members.security.taskId,before);assert.equal(f.team.snapshot().members.security.resumeMode,'checkpoint_continuation');assert.equal(f.team.snapshot().members.security.threadId,'thread-security-continuation');assert.equal(f.team.snapshot().members.lead.threadId,null);
});
