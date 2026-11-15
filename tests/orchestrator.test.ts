import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {capabilities,buildContext,collectResult,parsePlan,selectEmployee,validatePlan,validateWorkflowBook} from '../src/orchestration/model.ts';
import type {Context,Execution,ExecutionPort,WorkflowTask} from '../src/orchestration/model.ts';
import {MemoryWorkflowStorage,MockExecutionPort,mockPlan} from '../src/orchestration/MockExecutionPort.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MemoryCheckpointStorage} from '../src/checkpoints/model.ts';
class Port implements ExecutionPort {
 source='mock' as const;maxActive=2;calls:{task:WorkflowTask;context:Context;id:string}[]=[];executions=new Map<string,Execution>();
 people=Object.fromEntries(Object.entries(capabilities).map(([,c])=>[c.agentId,{connected:true,execution:'idle',currentTask:null as string|null,skills:Object.values(capabilities).filter(v=>v.agentId===c.agentId).map(v=>v.skill)}]));
 availability(){return structuredClone(this.people);}
 async start(task:WorkflowTask,context:Context,id:string){assert.ok(!this.executions.has(id),'duplicate start');this.calls.push({task:structuredClone(task),context:structuredClone(context),id});this.people[task.agentId].execution='working';this.people[task.agentId].currentTask=id;this.executions.set(id,{id,status:'running'});}
 read(t:WorkflowTask){return this.executions.get(t.executionId!)??{id:t.executionId!,status:'missing' as const};}
 async pause(t:WorkflowTask){this.executions.set(t.executionId!,{id:t.executionId!,status:'paused',kind:'pause',checkpointId:'checkpoint-1'});this.people[t.agentId].execution='paused';}
 async resume(t:WorkflowTask){this.executions.set(t.executionId!,{id:t.executionId!,status:'running'});this.people[t.agentId].execution='working';}
 async cancel(t:WorkflowTask){this.executions.set(t.executionId!,{id:t.executionId!,status:'failed'});this.people[t.agentId].execution='idle';}
 async resolveApproval(t:WorkflowTask){await this.pause(t);}
 async prepareRetry(t:WorkflowTask){this.people[t.agentId].execution='idle';}
 complete(id:string,result:string){const c=this.calls.find(c=>c.id===id)!;this.executions.set(id,{id,status:'completed',result});this.people[c.task.agentId].execution='completed';}
 fail(t:WorkflowTask){this.executions.set(t.executionId!,{id:t.executionId!,status:'failed',kind:'recoverable',error:'Temporary failure'});this.people[t.agentId].execution='error';}
}
async function fixture(scenario:'parallel'|'sequential'='parallel'){
 const port=new Port(),storage=new MemoryWorkflowStorage(),engine=new Orchestrator(port,storage);await engine.create('Read-only project analysis','flow1');await engine.tick();port.complete(port.calls[0].id,JSON.stringify(mockPlan(scenario)));await engine.tick();return {port,storage,engine,w:()=>engine.snapshot().workflows[0]};
}
test('Lead decomposition validates arbitrary DAGs, not a permanently fixed employee chain',()=>{
 const p=mockPlan('parallel');assert.equal(parsePlan('```json\n'+JSON.stringify(p)+'\n```').length,6);
 const minimal={tasks:[{...p.tasks[0],id:'one'}]};assert.equal(validatePlan(minimal).length,1);
 for(const mutate of [(p:any)=>p.tasks.push({...p.tasks[0]}),(p:any)=>p.tasks[0].dependencies.push('missing'),(p:any)=>{p.tasks[0].dependencies=['api'];p.tasks[1].dependencies=['design'];},(p:any)=>p.tasks[0].permissions=['write'],(p:any)=>p.tasks[0].agentId='director',(p:any)=>p.tasks[0].type='shell',(p:any)=>p.tasks[0].requiredSkills=[]]){const bad=structuredClone(p);mutate(bad);assert.throws(()=>validatePlan(bad));}
});
test('selection requires correct role, Skills, connection, availability and no paused/error state',()=>{
 const t=mockPlan('parallel').tasks[0],p=new Port();assert.equal(selectEmployee(t,p.people),'design');
 for(const state of ['working','paused','error','waiting'])assert.equal(selectEmployee(t,{...p.people,design:{...p.people.design,execution:state}}),null);
 assert.equal(selectEmployee(t,{...p.people,design:{...p.people.design,skills:[]}}),null);assert.equal(selectEmployee(t,{...p.people,design:{...p.people.design,connected:false}}),null);
});
test('parallel independent tasks run together; dependent frontend waits for BOTH results',async()=>{
 const f=await fixture();assert.deepEqual(f.port.calls.slice(1).map(c=>c.task.id),['design','api']);assert.equal(f.w().tasks.find(t=>t.id==='ui')!.status,'pending');
 f.port.complete(f.port.calls[1].id,'Design decision');await f.engine.tick();assert.equal(f.port.calls.length,3);
 f.port.complete(f.port.calls[2].id,'API decision');await f.engine.tick();const ui=f.port.calls.at(-1)!;assert.equal(ui.task.id,'ui');assert.deepEqual(ui.context.upstream.map(d=>d.taskId),['design','api']);assert.match(ui.context.upstream[0].result.summary,/Design decision/);
});
test('sequential dependencies and full completion keep exact execution order and real results',async()=>{
 const f=await fixture('sequential');for(let n=0;n<5&&f.w().status!=='completed';n++){for(const c of f.port.calls)if(f.port.read(c.task).status==='running')f.port.complete(c.id,'Confirmed result');await f.engine.tick();}
 assert.equal(f.w().status,'completed');assert.deepEqual(f.port.calls.map(c=>c.task.id),['plan','api','checks','summary']);assert.ok(f.engine.snapshot().events.some(e=>e.type==='workflow_completed'));
});
test('scheduler serializes concurrent ticks and duplicate root requests without duplicate execution',async()=>{
 const p=new Port(),s=new MemoryWorkflowStorage(),e=new Orchestrator(p,s);await Promise.all([e.create('Analysis','same'),e.create('Analysis','same')]);await Promise.all(Array.from({length:10},()=>e.tick()));assert.equal(p.calls.length,1);assert.equal(e.snapshot().workflows.length,1);await assert.rejects(e.create('Other','same'));await assert.rejects(e.create('Other','another'));
});
test('global concurrency includes individually running employees and supports one-slot execution',async()=>{
 const p=new Port();p.maxActive=1;const e=new Orchestrator(p,new MemoryWorkflowStorage());p.people.security.execution='working';await e.create('Analysis','single');await e.tick();assert.equal(p.calls.length,0);p.people.security.execution='idle';await e.tick();assert.equal(p.calls.length,1);p.complete(p.calls[0].id,JSON.stringify(mockPlan('parallel')));await e.tick();assert.equal(p.calls.length,2);
});
test('workflow pause checkpoints all running tasks and resume keeps IDs and completed work',async()=>{
 const f=await fixture();const ids=f.port.calls.map(c=>c.id);await f.engine.command('flow1','pause');assert.equal(f.w().status,'paused');assert.ok(f.w().checkpoint);assert.equal(f.w().tasks[0].status,'completed');await f.engine.command('flow1','resume');await f.engine.resumeEligible();await f.engine.tick();assert.deepEqual(f.port.calls.map(c=>c.id),ids);assert.equal(f.w().tasks.filter(t=>t.status==='running').length,2);
});
test('agent pause, verified usage limit and disconnect block dependencies and preserve checkpoint',async()=>{
 for(const kind of ['pause','usage_limit','disconnect'] as const){const f=await fixture('sequential');const t=f.w().tasks.find(t=>t.id==='api')!;await f.port.pause(t);f.port.executions.set(t.executionId!,{id:t.executionId!,status:'paused',kind,checkpointId:'saved'});await f.engine.tick();assert.equal(f.w().status,'paused');assert.equal(f.w().tasks.find(x=>x.id==='api')!.error!.kind,kind);assert.equal(f.w().tasks.find(x=>x.id==='checks')!.status,'pending');assert.equal(f.w().tasks.find(x=>x.id==='api')!.checkpointId,'saved');}
});
test('restart requires explicit resume, reconciles original IDs and never repeats completed tasks',async()=>{
 const f=await fixture('sequential');await f.engine.command('flow1','pause');const calls=f.port.calls.length;
 const restored=new Orchestrator(f.port,f.storage);await restored.tick();assert.equal(restored.snapshot().workflows[0].status,'paused');assert.equal(f.port.calls.length,calls);await restored.command('flow1','resume');await restored.resumeEligible();assert.equal(f.port.calls.length,calls);assert.equal(restored.snapshot().workflows[0].tasks[0].status,'completed');
});
test('missing execution after crash blocks resume instead of submitting duplicate work',async()=>{
 const f=await fixture('sequential');const restored=new Orchestrator(new Port(),f.storage);await assert.rejects(restored.command('flow1','resume'),/missing/);assert.equal(restored.snapshot().workflows[0].status,'paused');
});
test('approval waits for Director and never auto-rejects or grants additional permission',async()=>{
 const f=await fixture('sequential'),t=f.w().tasks.find(t=>t.id==='api')!;let denied=0;f.port.resolveApproval=async task=>{denied++;await f.port.pause(task);};f.port.executions.set(t.executionId!,{id:t.executionId!,status:'approval'});await f.engine.tick();assert.equal(denied,0);assert.equal(f.w().status,'paused');await assert.rejects(f.engine.command('flow1','resume'),/permissions/);await f.engine.command('flow1','reject_approval','api');assert.equal(denied,1);await f.engine.command('flow1','resume');await f.engine.resumeEligible();assert.equal(f.port.calls.length,2);
});
test('recoverable failures require explicit bounded retry; permanent failures cannot retry',async()=>{
 const f=await fixture('sequential');for(let attempt=1;attempt<=3;attempt++){const t=f.w().tasks.find(t=>t.id==='api')!;f.port.fail(t);await f.engine.tick();assert.equal(f.w().status,'paused');assert.equal(f.port.calls.length,attempt+1);if(attempt<3){await f.engine.command('flow1','retry','api');f.port.people.backend.execution='idle';await f.engine.command('flow1','resume');await f.engine.tick();}}
 await assert.rejects(f.engine.command('flow1','retry','api'),/limit/);
 const g=await fixture('sequential');const t=g.w().tasks.find(t=>t.id==='api')!;g.port.executions.set(t.executionId!,{id:t.executionId!,status:'failed',kind:'permanent',error:'Unsafe task'});await g.engine.tick();await assert.rejects(g.engine.command('flow1','retry','api'),/safe/);
});
test('invalid model plan pauses safely; unknown commands/identifiers never reach execution',async()=>{
 const p=new Port(),e=new Orchestrator(p,new MemoryWorkflowStorage());await e.create('Analysis','safe');await e.tick();p.complete(p.calls[0].id,'Run shell now');await e.tick();assert.equal(e.snapshot().workflows[0].tasks[0].error!.kind,'permanent');assert.equal(p.calls.length,1);await assert.rejects(e.command('../foreign','pause'));await assert.rejects(e.command('safe','retry','foreign'));await assert.rejects(e.create('password=not-allowed','secret'));
});
test('context is direct-only, attributed, bounded and excludes conversation history',async()=>{
 const f=await fixture();for(const c of f.port.calls.slice(1))f.port.complete(c.id,'A'.repeat(6000));await f.engine.tick();const c=f.port.calls.at(-1)!.context;assert.ok(JSON.stringify(c).length<5000);assert.ok(!c.upstream.some(d=>d.taskId==='plan'));assert.throws(()=>buildContext(f.w(),{...f.w().tasks[0],dependencies:['missing']}));
});
test('cancel stops owned work, releases employees and retains confirmed results',async()=>{const f=await fixture();await f.engine.command('flow1','cancel');assert.equal(f.w().status,'cancelled');assert.equal(f.w().tasks[0].status,'completed');assert.ok(f.w().tasks.slice(1).every(t=>t.status==='cancelled'));await f.engine.create('Next analysis','next');});
test('invalid or failing workflow storage blocks all execution without overwriting evidence',async()=>{
 let writes=0;const p=new Port(),e=new Orchestrator(p,{load(){throw new Error('corrupt');},save(){writes++;}});assert.ok(e.recoveryError);await assert.rejects(e.create('Test','blocked'));assert.equal(writes,0);assert.equal(p.calls.length,0);
 const s=new MemoryWorkflowStorage(),f=new Orchestrator(p,s);await f.create('Test','saved');s.save=()=>{throw new Error('locked');};await assert.rejects(f.tick());assert.equal(p.calls.length,0);
});
for(const scenario of ['sequential','parallel','failure','pause','approval','limit'] as const)test(`MockCodexAdapter scenario ${scenario} uses actual mock tasks and Stage 4B checkpoints`,async()=>{
 const cp=new MemoryCheckpointStorage(),adapter=new MockCodexAdapter(cp),port=new MockExecutionPort(adapter),store=new MemoryWorkflowStorage(),e=new Orchestrator(port,store);port.scenario=scenario;await adapter.action('connect_all');await e.create('Mock analysis','mock-'+scenario);
 for(let n=0;n<15&&e.snapshot().workflows[0].status!=='completed';n++){
  await e.tick();const w=e.snapshot().workflows[0];if(w.status==='paused'){
   for(const t of w.tasks){if(t.error?.kind==='approval')await e.command(w.id,'reject_approval',t.id);if(t.status==='failed')await e.command(w.id,'retry',t.id);}
   await e.command(w.id,'resume');await e.resumeEligible();
  }
  await port.advance(e.snapshot().workflows[0].tasks);await e.tick();
 }
 assert.equal(e.snapshot().workflows[0].status,'completed');assert.equal(adapter.getAgents().length,8);assert.ok(cp.load().checkpoints.length);assert.ok(adapter.getTasks().every(t=>t.status==='completed'||t.status==='failed'));
});
test('mock task + workflow checkpoints survive a genuine adapter/engine reconstruction',async()=>{
 const cp=new MemoryCheckpointStorage(),s=new MemoryWorkflowStorage(),a=new MockCodexAdapter(cp),p=new MockExecutionPort(a),e=new Orchestrator(p,s);await a.action('connect_all');await e.create('Mock restore','restore');await e.tick();await p.advance(e.snapshot().workflows[0].tasks);await e.tick();await e.command('restore','pause');
 const a2=new MockCodexAdapter(cp),p2=new MockExecutionPort(a2),e2=new Orchestrator(p2,s);await a2.action('connect_all');assert.equal(e2.snapshot().workflows[0].status,'paused');const ids=a2.getTasks().map(t=>t.id);await e2.command('restore','resume');await e2.resumeEligible();assert.deepEqual(a2.getTasks().map(t=>t.id),ids);assert.equal(e2.snapshot().workflows[0].tasks[0].status,'completed');
});
test('structured handoff retains decisions/warnings/issues; read-only file change claims are rejected',()=>{
 const r={summary:'Observed API evidence',filesChanged:[],decisions:['Keep one writer'],warnings:['Tests not run'],unresolved:['Director decision needed']};assert.deepEqual(collectResult(JSON.stringify(r)),r);assert.throws(()=>collectResult(JSON.stringify({...r,filesChanged:['server/http.mjs']})),/Read-only/);assert.match(collectResult('password=private-value').summary,/REDACTED/);
});
test('saved workflow validates ownership, permissions, context attribution, timestamps and orphan events',async()=>{
 const f=await fixture();const book=f.engine.snapshot();
 for(const mutate of [(b:any)=>b.workflows[0].tasks[1].agentId='qa',(b:any)=>b.workflows[0].tasks[1].permissions=['write'],(b:any)=>b.workflows[0].tasks[1].executionId='wf-foreign-task-1',(b:any)=>b.workflows[0].tasks[1].inputContext.workflowId='foreign',(b:any)=>b.workflows[0].createdAt='invalid',(b:any)=>b.events[0].workflowId='foreign']){const bad=structuredClone(book);mutate(bad);assert.throws(()=>validateWorkflowBook(bad,'mock'));}
});
test('unchanged paused workflow does not continually rewrite storage',async()=>{
 const f=await fixture();await f.engine.command('flow1','pause');let writes=0;const save=f.storage.save.bind(f.storage);f.storage.save=b=>{writes++;save(b);};await f.engine.tick();await f.engine.tick();assert.equal(writes,0);
});
test('controlled handoff preserves both concise observations, all warnings and unresolved entries',async()=>{
 const f=await fixture('sequential'),task=f.w().tasks.find(t=>t.id==='api')!;
 const result={summary:'API evidence',filesChanged:[],decisions:['First observation: '+ 'A'.repeat(330),'Second observation: '+ 'B'.repeat(330)],warnings:['Not executed','Limited sources'],unresolved:['Director decision']};
 f.port.complete(task.executionId!,JSON.stringify(result));await f.engine.tick();assert.deepEqual(f.port.calls.at(-1)!.context.upstream[0].result,result);
});
