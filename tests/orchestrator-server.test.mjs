import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {TeamRuntime} from '../server/team.mjs';
import {RealExecutionPort,WorkflowFileStorage} from '../server/orchestration.mjs';
import {loadEmployee} from '../server/employee-config.mjs';
import {MemoryCheckpointStorage} from '../src/checkpoints/model.ts';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {MemoryWorkflowStorage,mockPlan} from '../src/orchestration/MockExecutionPort.ts';
import {emptyWorkflows} from '../src/orchestration/model.ts';
import {createBridge} from '../server/http.mjs';
import {CheckpointPilot} from '../server/checkpoint-pilot.mjs';
test('real port uses existing Codex RPC, exact execution IDs, profiles, Skills and checkpoint resume',async()=>{
 const root=resolve('.'),rpcs=new Map(),storage=new MemoryCheckpointStorage('codex');
 const team=new TeamRuntime({root,storage,maxActive:2,detect:async()=>({available:true,version:'codex-cli 0.144.5'}),makeRpc:agentId=>{
  const rpc={requests:[],n:0,closed:false,async open(){},close(){this.closed=true;},respond(){},reject(){},async request(method,params){this.requests.push({method,params});if(method==='account/read')return {account:{type:'chatgpt'}};if(method==='skills/list')return {data:[{skills:loadEmployee(root,agentId).skills.map(s=>({...s,enabled:true}))}]};if(method==='thread/start'||method==='thread/resume')return {thread:{id:params.threadId??`own-${agentId}-${this.n}`,status:{type:'idle'}},sandbox:{type:'readOnly',networkAccess:false},approvalPolicy:'on-request',approvalsReviewer:'user'};if(method==='turn/start'){const id=`turn-${agentId}-${++this.n}`;rpc.onNotification({method:'turn/started',params:{threadId:params.threadId,turn:{id,status:'inProgress'}}});return {turn:{id}};}if(method==='turn/interrupt'){rpc.onNotification({method:'turn/completed',params:{threadId:params.threadId,turn:{id:params.turnId,status:'interrupted'}}});}return {};}};rpcs.set(agentId,rpc);return rpc;
 }});
 const port=new RealExecutionPort(team),store=new MemoryWorkflowStorage('codex'),engine=new Orchestrator(port,store);await team.action('connect_all');await engine.create('Analyze API and UI read-only','real-port');await engine.tick();
 const lead=team.members.get('lead'),rpc=rpcs.get('lead'),request=rpc.requests.find(r=>r.method==='turn/start');assert.match(request.params.input[0].text,/CAPABILITIES=/);assert.match(request.params.input[0].text,/Analyze API and UI/);assert.ok(lead.state.taskId.startsWith('wf-real-port-plan-'));
 const done=(id,text)=>{const p=team.members.get(id),rpc=rpcs.get(id);rpc.onNotification({method:'item/completed',params:{threadId:p.state.threadId,turnId:p.state.turnId,item:{type:'agentMessage',phase:'final_answer',text}}});rpc.onNotification({method:'turn/completed',params:{threadId:p.state.threadId,turn:{id:p.state.turnId,status:'completed'}}});};
 done('lead',JSON.stringify(mockPlan('parallel')));await engine.tick();assert.deepEqual(team.snapshot().activeEmployees.sort(),['backend','design']);const ids=engine.snapshot().workflows[0].tasks.filter(t=>t.status==='running').map(t=>t.executionId);
 await engine.command('real-port','pause');assert.equal(engine.snapshot().workflows[0].status,'paused');assert.ok(storage.load().checkpoints.filter(c=>ids.includes(c.taskId)).every(c=>c.resumable&&c.lastKnownState.stopConfirmed));
 const restored=new Orchestrator(port,store);await restored.command('real-port','resume');await restored.resumeEligible();assert.deepEqual(restored.snapshot().workflows[0].tasks.filter(t=>t.status==='running').map(t=>t.executionId),ids);assert.ok(rpcs.get('backend').requests.some(r=>r.method==='thread/resume'));
 for(const id of ['backend','design'])assert.equal(rpcs.get(id).requests.filter(r=>r.method==='thread/start').length,1);await restored.command('real-port','cancel');assert.equal(restored.snapshot().workflows[0].status,'cancelled');assert.equal(team.members.get('backend').state.execution,'idle');team.disconnect();
});
test('workflow HTTP actions retain nonce/origin boundaries and reject untrusted fields',async()=>{
 const calls=[],engine={snapshot:()=>({workflows:[]}),async create(...a){calls.push(a);},async command(...a){calls.push(a);}},pilot={snapshot:()=>({}),disconnect(){},action(){}};
 const bridge=createBridge({root:resolve('.'),port:0,pilot,orchestration:{engine,close(){}}});await bridge.listen();const base=`http://127.0.0.1:${bridge.server.address().port}`;
 try{const {token}=await(await fetch(base+'/api/codex/session')).json(),headers={'content-type':'application/json','x-ai-office-token':token};const post=(data,h=headers)=>fetch(base+'/api/workflows/action',{method:'POST',headers:h,body:JSON.stringify(data)});
  assert.equal((await post({action:'create',workflowId:'w',rootTask:'Analysis'},{'content-type':'application/json'})).status,403);assert.equal((await post({action:'create',workflowId:'w',rootTask:'Analysis'},{...headers,origin:'https://foreign.example'})).status,403);
  for(const v of [null,[],{action:'shell',workflowId:'w'},{action:'create',workflowId:'w',rootTask:'Analysis',command:'injected'},{action:'resume',workflowId:'w',rootTask:'extra'}])assert.equal((await post(v)).status,409);
  assert.equal(calls.length,0);assert.equal((await post({action:'create',workflowId:'w',rootTask:'Analysis'})).status,200);assert.deepEqual(calls[0],['Analysis','w']);
 }finally{await bridge.close();}
});
test('workflow disk checkpoint is atomic, survives reload and preserves corrupt data',()=>{
 const base=resolve('work/workflow-storage');mkdirSync(base,{recursive:true});const root=mkdtempSync(resolve(base,'store-')),s=new WorkflowFileStorage(root);s.save(emptyWorkflows('codex'));assert.deepEqual(new WorkflowFileStorage(root).load(),emptyWorkflows('codex'));writeFileSync(s.file,'invalid');assert.throws(()=>s.load());const engine=new Orchestrator({source:'codex'},s);assert.ok(engine.recoveryError);assert.equal(readFileSync(s.file,'utf8'),'invalid');
});
test('failed owned recovery write after preflight prevents any real thread or turn submission',async()=>{
 const store=new MemoryCheckpointStorage('codex'),save=store.save.bind(store);let writes=0,calls=0;store.save=b=>{if(++writes>1)throw new Error('locked');save(b);};
 const p=new CheckpointPilot({root:resolve('.'),storage:store,load:()=>({skills:[],instructions:'Read-only',profileHash:'hash'}),context:()=>[]});p.state.connection='connected';p.rpc={async request(){calls++;throw new Error('Must not execute');}};await assert.rejects(p.start(),/Recovery storage/);assert.equal(calls,0);assert.ok(p.state.recoveryError);
});
