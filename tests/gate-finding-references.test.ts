import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {findingReferencesAllowed} from '../src/orchestration/task-inputs.ts';
import {gatePass} from '../src/orchestration/team-workflow.ts';
import {validateWorkflowBook} from '../src/orchestration/model.ts';
import type {Finding} from '../src/orchestration/team-workflow.ts';

async function fixture(){
 const adapter=new MockCodexAdapter(undefined,undefined,false),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage(),engine=new Orchestrator(port,storage);port.scenario='team-parallel';
 const result=port.teamResult.bind(port);port.teamResult=t=>{const r=result(t) as any;if(t.teamSpec?.kind==='qa'){r.summary='Browser contract failed; scoped integrator needs approved dependency context';r.team.verdict='FAIL';r.team.findings=[{id:'browser-contract',severity:'high',message:r.summary,responsibleTask:'ui',reproduction:'Inspect the existing failed browser receipt',files:['src/team-ui.ts','src/team-api.ts']}];}return r;};
 // Simulate the previous validator rejecting this same immutable completed response.
 let legacyReject=true;port.validateResult=t=>{if(legacyReject&&t.teamSpec?.kind==='qa')throw Error('Finding outside responsible task scope');};
 await adapter.action('connect_all');await engine.create('Implement integrated controls','references',{team:true});
 for(let i=0;i<20;i++){await engine.tick();for(const a of engine.snapshot().workflows[0].team!.approvals.filter(a=>a.status==='pending'))await engine.command('references','approve_action',a.id);await port.advance(engine.snapshot().workflows[0].tasks);await engine.tick();if(engine.snapshot().workflows[0].tasks.find(t=>t.teamSpec?.kind==='qa')?.status==='failed')break;}
 const w=()=>engine.snapshot().workflows[0];assert.equal(w().status,'paused');assert.equal(w().tasks.find(t=>t.teamSpec?.kind==='qa')!.status,'failed');
 return {adapter,port,engine,storage,w,allow:()=>{legacyReject=false;}};
}

test('an independent gate may cite an approved dependency without granting the named owner any additional writes',async()=>{
 const f=await fixture();try{const w=f.w(),qa=w.tasks.find(t=>t.teamSpec?.kind==='qa')!,owner=w.tasks.find(t=>t.id==='ui')!,finding=(f.port.teamResult(qa) as any).team.findings[0] as Finding;
  assert(qa.inputContext!.inputs!.requiredFiles!.includes('src/team-api.ts'));assert(!owner.teamSpec!.scope.includes('src/team-api.ts'));
  assert(findingReferencesAllowed(w,qa,finding));assert.deepEqual(owner.teamSpec!.scope,['src/team-ui.ts','tests/team-ui.test.ts']);
  assert(!findingReferencesAllowed(w,qa,{...finding,responsibleTask:'unknown-owner'}));
  assert(!findingReferencesAllowed(w,qa,{...finding,files:['src/team-api.ts']}));
  assert(!findingReferencesAllowed(w,qa,{...finding,files:['src/team-ui.ts','src/foreign.ts']}));
  assert(!findingReferencesAllowed(w,qa,{...finding,files:['src/team-ui.ts','tests/team-api.test.ts']}));
  const unsupplied=structuredClone(qa);unsupplied.inputContext!.inputs!.requiredFiles=[];assert(!findingReferencesAllowed(w,unsupplied,finding));
  const forged=structuredClone(qa);forged.inputContext!.inputs!.requiredFiles!.push('src/foreign.ts');assert(!findingReferencesAllowed(w,forged,{...finding,files:['src/team-ui.ts','src/foreign.ts']}));
  const legacy=structuredClone(qa);delete legacy.inputContext!.inputs!.version;assert(!findingReferencesAllowed(w,legacy,finding));
  const foreignOwner={...structuredClone(owner),id:'unrelated'};w.tasks.push(foreignOwner);assert(!findingReferencesAllowed(w,qa,{...finding,responsibleTask:foreignOwner.id}));
 }finally{f.adapter.stop();}
});

test('revalidation accepts the same saved FAIL without restarting, reapplying, rerunning checks or widening corrective scope',async()=>{
 const f=await fixture();try{const before=f.w(),qa=before.tasks.find(t=>t.teamSpec?.kind==='qa')!,raw=f.port.read(qa).result,jobs=f.adapter.getTasks().length,approvals=structuredClone(before.team!.approvals),scope=structuredClone(before.tasks.find(t=>t.id==='ui')!.teamSpec!.scope);
  f.allow();await f.engine.command(before.id,'revalidate_result',qa.id);const after=f.w(),accepted=after.tasks.find(t=>t.id===qa.id)!;
  assert.equal(accepted.status,'completed');assert.equal(accepted.result!.team!.verdict,'FAIL');assert.equal(gatePass(accepted),false);assert.equal(accepted.executionId,qa.executionId);assert.equal(f.port.read(accepted).result,raw);assert.equal(after.error,null);assert.equal(after.status,'paused');assert.equal(after.team!.final,null);
  assert.deepEqual(after.team!.approvals,approvals);assert.equal(f.adapter.getTasks().length,jobs);assert.deepEqual(after.tasks.find(t=>t.id==='ui')!.teamSpec!.scope,scope);assert(!after.tasks.some(t=>t.id.startsWith('fix-')));validateWorkflowBook(f.storage.book,'mock');
 }finally{f.adapter.stop();}
});
