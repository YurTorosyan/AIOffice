import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {capabilities} from '../src/orchestration/model.ts';
import type {Execution,ExecutionPort,WorkflowTask} from '../src/orchestration/model.ts';
function fixture(){
 let starts=0;const rows=new Map<string,Execution>(),people=Object.fromEntries(Object.values(capabilities).map(c=>[c.agentId,{connected:true,execution:'idle',currentTask:null as string|null,skills:[c.skill]}]));
 const port:ExecutionPort={source:'codex',maxActive:1,availability:()=>people,
  async start(t,_c,id){starts++;rows.set(id,{id,status:'running'});people[t.agentId].execution='working';throw Error('ack lost');},
  read:t=>rows.get(t.executionId!)??{id:t.executionId!,status:'missing'},
  async pause(t){rows.set(t.executionId!,{id:t.executionId!,status:'paused'});people[t.agentId].execution='paused';},async resume(){throw Error('No turn permitted');},async cancel(){},async resolveApproval(){},async prepareRetry(){throw Error('No blind retry permitted');}};
 return {port,rows,storage:new MemoryWorkflowStorage('codex'),starts:()=>starts};
}
test('S21 seeded ten-fold start-intent failure and lost acknowledgement never duplicate a start',async()=>{
 for(let seed=1;seed<=10;seed++){
  const before=fixture(),engine=new Orchestrator(before.port,before.storage);await engine.create('fixture','before-'+seed);const save=before.storage.save.bind(before.storage);before.storage.save=book=>{if(book.workflows.some(w=>w.tasks.some(t=>t.status==='launching')))throw Error('intent disk failure');save(book);};
  await assert.rejects(engine.tick());assert.equal(before.starts(),0);assert(engine.recoveryError);
  const lost=fixture(),after=new Orchestrator(lost.port,lost.storage);await after.create('fixture','lost-'+seed);await after.tick();await after.tick();const w=after.snapshot().workflows[0],id=w.tasks[0].executionId;
  assert.equal(w.status,'paused');assert.equal(w.tasks[0].status,'paused');assert.equal(w.tasks[0].error!.kind,'disconnect');assert.equal(lost.starts(),1);
  await assert.rejects(after.command(w.id,'retry','plan'));for(let n=0;n<3;n++)await after.tick();assert.equal(lost.starts(),1);assert.equal(after.snapshot().workflows[0].tasks[0].executionId,id);
 }
});
