import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {validateWorkflowBook} from '../src/orchestration/model.ts';
import {dependencySatisfied,gatePass,teamTaskPrompt} from '../src/orchestration/team-workflow.ts';
import {deferredVerificationCandidate,implementationHandoffReady,validateVerificationDeferral} from '../src/orchestration/implementation-handoff.ts';
import {RealExecutionPort} from '../server/orchestration.mjs';
async function fixture(){
 const adapter=new MockCodexAdapter(),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage();port.scenario='team-parallel';await adapter.action('connect_all');const engine=new Orchestrator(port,storage);await engine.create('Public garage implementation and browser checks','handoff',{team:true});await engine.tick();
 for(let i=0;i<2;i++){await port.advance(engine.snapshot().workflows[0].tasks);await engine.tick();}
 const approval=engine.snapshot().workflows[0].team!.approvals.find(a=>a.action==='apply_changes')!;await engine.command('handoff','approve_action',approval.id);await engine.command('handoff','pause');
 const w=storage.book.workflows[0],source=w.tasks.find(t=>t.id==='api')!;source.result!.team!.verdict='BLOCKED';source.result!.team!.findings=[{id:'pending-browser',severity:'medium',message:'Required browser keyboard and viewport checks have not been performed.',responsibleTask:source.id,reproduction:'After application integration, run approved QA checks.',files:[...source.teamSpec!.scope]}];
 const restored=new Orchestrator(port,storage);assert.equal(restored.recoveryError,null);return {adapter,port,storage,engine:restored,w:()=>restored.snapshot().workflows[0]};
}
test('explicit deferral unblocks integration without altering verdict, receipts, execution IDs or files',async()=>{
 const f=await fixture();try{const before=f.w(),source=before.tasks.find(t=>t.id==='api')!,ui=before.tasks.find(t=>t.id==='ui')!,jobs=f.adapter.getTasks().length;assert.equal(dependencySatisfied(before,ui,'api'),false);
 await f.engine.command('handoff','defer_verification','api');const w=f.w(),after=w.tasks.find(t=>t.id==='api')!;assert.equal(w.status,'paused');assert.deepEqual(after.result,source.result);assert.deepEqual(w.team!.approvals,before.team!.approvals);assert.equal(after.executionId,source.executionId);assert.equal(f.adapter.getTasks().length,jobs);assert.equal(gatePass(after),false);assert.equal(implementationHandoffReady(w,after),true);assert.equal(dependencySatisfied(w,w.tasks.find(t=>t.id==='ui')!,'api'),true);await f.engine.tick();assert.equal(f.adapter.getTasks().length,jobs);assert.equal(new Orchestrator(f.port,f.storage).recoveryError,null);await assert.rejects(f.engine.command('handoff','defer_verification','api'));
 }finally{f.adapter.stop();}
});
test('QA remains after UI integration and requires explicit test approval and actual mock receipts',async()=>{
 const f=await fixture();try{await f.engine.command('handoff','defer_verification','api');await f.engine.command('handoff','resume');await f.engine.tick();let w=f.w();assert.equal(w.tasks.find(t=>t.id==='ui')!.status,'running');assert.notEqual(w.team!.state,'CHANGES_REQUIRED');assert.equal(w.tasks.find(t=>t.teamSpec?.kind==='qa')!.executionId,null);assert(!w.team!.approvals.some(a=>a.action==='run_tests'));
 const ui=w.tasks.find(t=>t.id==='ui')!;assert.equal(ui.inputContext!.team!.handoffs.find(h=>h.sourceTaskId==='api')!.deferredVerification!.findings[0].id,'pending-browser');assert(teamTaskPrompt(ui,ui.inputContext!).includes('pending-browser'));
 await f.port.advance(w.tasks);await f.engine.tick();const apply=f.w().team!.approvals.find(a=>a.status==='pending'&&a.action==='apply_changes')!;await f.engine.command('handoff','approve_action',apply.id);await f.engine.tick();w=f.w();const qa=w.tasks.find(t=>t.id===w.team!.gates.qa)!;assert.equal(qa.executionId,null);assert.equal(qa.status,'paused');assert(w.team!.approvals.some(a=>a.status==='pending'&&a.action==='run_tests'));
 for(let i=0;i<30&&f.w().status==='running';i++){for(const a of f.w().team!.approvals.filter(a=>a.status==='pending'))await f.engine.command('handoff','approve_action',a.id);await f.port.advance(f.w().tasks);await f.engine.tick();}
 assert.equal(f.w().status,'completed');assert.equal(f.w().tasks.find(t=>t.id==='api')!.result!.team!.verdict,'BLOCKED');validateWorkflowBook(f.storage.book,'mock');
 }finally{f.adapter.stop();}
});
test('defects, failed checks, missing applied receipts, foreign scopes and high-severity findings never qualify',async()=>{
 const f=await fixture();try{for(const mutate of [
  (w:any,t:any)=>t.result.team.findings[0].severity='high',
  (w:any,t:any)=>t.result.team.findings[0].message='Browser regression failed; checks have not been performed.',
  (w:any,t:any)=>t.result.team.findings[0].files=['src/foreign.ts'],
  (w:any,t:any)=>t.result.team.findings.push({...t.result.team.findings[0],id:'defect',message:'Incorrect calculation'}),
  (w:any,t:any)=>w.team.approvals=[],
  (w:any,t:any)=>t.result.team.verdict='FAIL',
 ]){const w=structuredClone(f.w()),t=w.tasks.find(t=>t.id==='api')!;mutate(w,t);assert.equal(deferredVerificationCandidate(w,t),null);}
 }finally{f.adapter.stop();}
});
test('unperformed checks do not count as passing QA and original metadata cannot be forged',async()=>{
 const f=await fixture();try{await f.engine.command('handoff','defer_verification','api');const w=f.w(),t=w.tasks.find(t=>t.id==='api')!;w.status='completed';assert.throws(()=>validateVerificationDeferral(w,t),/passing QA evidence/);w.status='paused';t.verificationDeferral!.approvalId='foreign';assert.throws(()=>validateWorkflowBook({...f.storage.book,workflows:[w]},'mock'),/Invalid verification deferral/);
 }finally{f.adapter.stop();}
});
test('real deferral requires unchanged applied revision in the owned project',()=>{
 const w={projectId:'p',team:{approvals:[{taskId:'source',action:'apply_changes',status:'approved',revision:'a'.repeat(64)}]}},t={id:'source',teamSpec:{scope:['src/source.ts']}};let revision='a'.repeat(64);const port=new RealExecutionPort({projectId:'p'},{revision:()=>revision});port.validateVerificationDeferral(w,t);revision='b'.repeat(64);assert.throws(()=>port.validateVerificationDeferral(w,t),/changed/);assert.throws(()=>port.validateVerificationDeferral({...w,projectId:'other'},t),/ownership/);
});

test('completion accepts preserved report ownership only with an exact approved command and revision',async()=>{
 const f=await fixture();try{
  await f.engine.command('handoff','defer_verification','api');const w=f.w(),source=w.tasks.find(t=>t.id==='api')!,old=w.tasks.find(t=>t.id===w.team!.gates.qa)!;
  const evidence={reportOwnerTaskId:old.id,source:'runner' as const,command:'trusted browser',status:'PASS' as const,exitCode:0,revision:'a'.repeat(64),output:'passed',report:{version:1 as const,id:'qa-'+ 'b'.repeat(64),sha256:'c'.repeat(64),characters:6,complete:true}};
  const qa=structuredClone(old);qa.id='qa-evidence';qa.status='completed';qa.teamSpec!.testEvidence=[evidence];qa.result={...structuredClone(source.result!),team:{...structuredClone(source.result!.team!),verdict:'PASS',tests:[evidence],findings:[],patches:[]}};w.tasks.push(qa);w.team!.gates.qa=qa.id;w.status='completed';w.source='codex';
  const approval={id:'test-approval',taskId:old.id,action:'run_tests',status:'approved',revision:evidence.revision,commands:[evidence.command]} as any;w.team!.approvals.push(approval);
  const original=JSON.stringify(source.result);assert.doesNotThrow(()=>validateVerificationDeferral(w,source));assert.equal(JSON.stringify(source.result),original);
  approval.commands=['different command'];assert.throws(()=>validateVerificationDeferral(w,source),/passing QA evidence/);approval.commands=[evidence.command];approval.revision='d'.repeat(64);assert.throws(()=>validateVerificationDeferral(w,source),/passing QA evidence/);approval.revision=evidence.revision;approval.status='rejected';assert.throws(()=>validateVerificationDeferral(w,source),/passing QA evidence/);
 }finally{f.adapter.stop();}
});
test('failed QA still creates corrective work without copying the original deferral into a new task',async()=>{
 const f=await fixture();try{await f.engine.command('handoff','defer_verification','api');f.port.scenario='team-qa-fail';await f.engine.command('handoff','resume');for(let i=0;i<45&&f.w().status==='running';i++){await f.engine.tick();for(const a of f.w().team!.approvals.filter(a=>a.status==='pending'))await f.engine.command('handoff','approve_action',a.id);await f.port.advance(f.w().tasks);await f.engine.tick();}
 const w=f.w(),fixes=w.tasks.filter(t=>t.id.startsWith('fix-'));assert(fixes.length);assert(fixes.every(t=>!t.verificationDeferral));assert.equal(w.status,'completed');assert.equal(w.tasks.find(t=>t.id==='api')!.result!.team!.verdict,'BLOCKED');assert.equal(w.tasks.find(t=>t.id===w.team!.gates.qa)!.result!.team!.verdict,'PASS');validateWorkflowBook(f.storage.book,'mock');
 }finally{f.adapter.stop();}
});
