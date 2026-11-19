import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {workflowBudgets,proposalBudget} from '../src/orchestration/budgets.ts';
import {inputContract} from '../src/orchestration/input-contract.ts';
import {buildTaskInputs,validateTaskInputs} from '../src/orchestration/task-inputs.ts';
import {lineageAttempts} from '../src/orchestration/attempt-budget.ts';
import {workflowDiagnostics} from '../src/orchestration/diagnostics.ts';
import {evidenceState,webEvidenceComplete} from '../src/orchestration/quality.ts';
import {teamOutputSchema} from '../server/team-output.mjs';
import {TeamActions} from '../server/team-actions.mjs';
import {RealExecutionPort} from '../server/orchestration.mjs';
import type {MockScenario} from '../src/orchestration/MockExecutionPort.ts';
import type {WorkflowTask,Workflow} from '../src/orchestration/model.ts';
import type {TestEvidence} from '../src/orchestration/team-workflow.ts';

async function fixture(slots=2,scenario:MockScenario='team-parallel'){
 const adapter=new MockCodexAdapter(undefined,undefined,false),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage();
 Object.defineProperty(port,'maxActive',{value:slots});port.scenario=scenario;
 await adapter.action('connect_all');const engine=new Orchestrator(port,storage);await engine.create('Implement a typed helper with tests','stabilize',{team:true,maxCycles:1});
 return {adapter,port,storage,engine,w:()=>engine.snapshot().workflows[0]};
}
async function advance(f:Awaited<ReturnType<typeof fixture>>,approve=true){
 await f.engine.tick();if(approve)for(const a of f.w().team!.approvals.filter(a=>a.status==='pending'))await f.engine.command('stabilize','approve_action',a.id);
 await f.port.advance(f.w().tasks);await f.engine.tick();
}

for(const slots of [1,2])test('P1–P3 full graph, shared admission and independent gates with '+slots+' slots',async()=>{
 const f=await fixture(slots);const evidence:unknown[]=[];let peak=0;
 try{for(let n=0;n<40&&f.w().status==='running';n++){
  await advance(f);const w=f.w(),running=w.tasks.filter(t=>['running','launching'].includes(t.status));peak=Math.max(peak,running.length);
  assert(running.length<=slots);assert.equal(new Set(running.map(t=>t.agentId)).size,running.length);
  for(const task of running)assert(task.dependencies.every(id=>w.tasks.some(t=>t.id===id&&t.status==='completed')));
  evidence.push({step:n,status:w.status,running:running.map(t=>t.executionId),approvals:w.team!.approvals.map(a=>({id:a.id,status:a.status})),diagnostics:workflowDiagnostics(w)});
 }
 const w=f.w();assert.equal(w.status,'completed');assert.equal(w.team!.final!.qa,'PASS');assert.equal(w.team!.final!.review,'APPROVED');
 assert.equal(w.tasks.find(t=>t.id===w.team!.gates.review)!.agentId,'review');assert.equal(w.tasks.find(t=>t.id===w.team!.gates.integration)!.agentId,'lead');
 assert(peak>=1);mkdirSync('work/stabilization-matrix',{recursive:true});writeFileSync(resolve('work/stabilization-matrix/slots-'+slots+'.json'),JSON.stringify({slots,peak,realCodexJobs:0,evidence},null,2));
 }finally{f.adapter.stop();}
});

test('P1 one immutable budget profile governs schema and proposal aggregate, including exact boundaries',()=>{
 const schema=teamOutputSchema({id:'impl',teamSpec:{kind:'implementation',scope:['src/a.ts']}}),patch=schema.properties.team.properties.patches;
 assert.equal(patch.maxItems,workflowBudgets.maxFilesPerImplementationTask);assert.equal(patch.items.properties.content.maxLength,workflowBudgets.maxCharactersPerPatchFile);
 assert.equal(proposalBudget([{path:'src/a.ts',content:'x'.repeat(12000)},{path:'src/b.ts',content:'y'.repeat(12000)}]).characters,24000);
 assert.throws(()=>proposalBudget([{path:'src/a.ts',content:'x'.repeat(12000)},{path:'src/b.ts',content:'y'.repeat(12000)},{path:'src/c.ts',content:'z'}]),/24001.*24000/);
 assert.throws(()=>proposalBudget([{path:'src/a.ts',content:'x'.repeat(12001)}]),/12000/);
});

test('P1 full task snapshot retains criterion tails, source provenance, every finding and all QA receipts',async()=>{
 const f=await fixture();try{for(let i=0;i<3;i++)await advance(f);
  const w=f.w(),target=w.tasks.find(t=>t.id==='ui')!;target.teamSpec!.acceptance=['a'.repeat(950)+' CRITERION TAIL'];target.description='d'.repeat(1500)+' DESCRIPTION TAIL';
  const source=w.tasks.find(t=>t.id==='api')!;source.result!.warnings=['Warning must survive'];source.result!.unresolved=['Unresolved must survive'];source.result!.team!.findings=[{id:'finding',severity:'medium',message:'Retained finding',files:source.teamSpec!.scope,responsibleTask:source.id,reproduction:'Exact reproducer'}];
  const context={rootTask:w.rootTask,workflowId:w.id,taskId:target.id,upstream:[],inputs:buildTaskInputs(w,target)},text=inputContract(target,context),parsed=JSON.parse(text);
  assert(parsed.acceptance[0].endsWith('CRITERION TAIL'));assert(parsed.description.endsWith('DESCRIPTION TAIL'));
  const handoff=parsed.inputs.handoffs.find((h:any)=>h.taskId==='api');assert.equal(handoff.description,source.description);assert.equal(handoff.findings[0].id,'finding');assert.equal(handoff.executionId,source.executionId);assert.deepEqual(handoff.unresolved,source.result!.unresolved);
  const legacy=structuredClone(context.inputs);delete legacy.version;delete legacy.requiredFiles;legacy.handoffs=legacy.handoffs.map(({taskId,agentId,summary,decisions,codeInfo,acceptance,verdict})=>({taskId,agentId,summary,decisions,codeInfo,acceptance,verdict}));
  target.inputContext={...context,inputs:legacy};validateTaskInputs(w,target);target.inputContext.inputs.handoffs[0].acceptance.push('forged');assert.throws(()=>validateTaskInputs(w,target),/approved dependency/);
 }finally{f.adapter.stop();}
});

test('P1 admission rejection retains accepted plan and spends no specialist execution or retry attempt',async()=>{
 const f=await fixture();try{f.port.validatePlan=()=>{throw Error('Required QA profile unavailable');};await f.engine.tick();await f.port.advance(f.w().tasks);await f.engine.tick();
  const w=f.w();assert(w.planned);assert.equal(w.status,'paused');assert.match(w.error!,/preflight/);assert(w.tasks.filter(t=>t.id!=='plan').every(t=>t.executionId===null&&t.attempts===0));assert.equal(f.adapter.getTasks().length,1);
 }finally{f.adapter.stop();}
});

test('P2 receipts keep missing, stale, blocked, failed and passed distinct; browser/build cannot be inferred from unit PASS',()=>{
 const receipt=(command:string,status:TestEvidence['status']='PASS'):TestEvidence=>({command,status,exitCode:status==='PASS'?0:null,output:'fixture',revision:'a'.repeat(64),source:'runner'});
 assert.equal(evidenceState([]),'not_run');assert.equal(evidenceState([receipt('unit')],{commands:['unit','build','browser']}),'incomplete');
 assert.equal(evidenceState([receipt('unit')],{revision:'b'.repeat(64)}),'stale');assert.equal(evidenceState([receipt('unit','BLOCKED')]),'blocked');assert.equal(evidenceState([receipt('unit','FAIL')]),'failed');assert.equal(evidenceState([receipt('unit')]),'passed');
 assert(!webEvidenceComplete([receipt('vitest run tests/App.test.tsx')]));assert(webEvidenceComplete([receipt('vitest run tests/App.test.tsx'),receipt('tsc --noEmit [trusted] && vite build'),receipt('Playwright Chromium (sandboxed)')]));
});

test('P3 continuation IDs share original attempts while a separately bounded corrective round retains its own budget',async()=>{
 const f=await fixture();try{const w=f.w(),source={...w.tasks[0],id:'source',agentId:'frontend',attempts:2,teamSpec:{kind:'implementation',scope:['src/a.ts'],remediationFor:[]}} as WorkflowTask,
  next={...structuredClone(source),id:'source-context-1',attempts:1,teamSpec:{...source.teamSpec!,remediationFor:['source']}};
  w.tasks.push(source,next);assert.equal(lineageAttempts(w,next).attempts,3);const fix={...structuredClone(next),id:'fix-1-0',attempts:0};w.tasks.push(fix);assert.equal(lineageAttempts(w,fix).attempts,0);
 }finally{f.adapter.stop();}
});

test('P3 selective cancellation recovery retains completed work and rejected approvals, prepares a fresh exact confirmation only',async()=>{
 const f=await fixture(2,'team-basic');try{for(let i=0;i<2;i++)await advance(f,false);const before=f.w(),proposal=before.team!.approvals.find(a=>a.status==='pending')!;
  await f.engine.command('stabilize','cancel');const jobs=f.adapter.getTasks().length;await f.engine.command('stabilize','restore_cancelled');const w=f.w();assert.equal(w.status,'paused');assert.equal(f.adapter.getTasks().length,jobs);
  assert.equal(w.team!.approvals.find(a=>a.id===proposal.id)!.status,'rejected');const fresh=w.team!.approvals.find(a=>a.status==='pending')!;assert.notEqual(fresh.id,proposal.id);assert.deepEqual(fresh.patches,proposal.patches);assert.equal(fresh.revision,null);assert.deepEqual(w.tasks.find(t=>t.id===proposal.taskId)!.result,before.tasks.find(t=>t.id===proposal.taskId)!.result);
 }finally{f.adapter.stop();}
});
