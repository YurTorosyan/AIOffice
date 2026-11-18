import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {parseTeamPlan,teamPlanningPrompt} from '../src/orchestration/team-workflow.ts';
import {diagnosePlan,suggestPlanRepair} from '../src/orchestration/plan-recovery.ts';
import {RealExecutionPort} from '../server/orchestration.mjs';
import {validateWorkflowBook} from '../src/orchestration/model.ts';
const original=readFileSync(new URL('./fixtures/oversized-team-plan.json',import.meta.url),'utf8');
async function fixture(text=original){
 const adapter=new MockCodexAdapter(),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage();
 let calls=0,result=text;port.start=async()=>{calls++;};port.read=t=>({id:t.executionId!,status:'completed',result});
 await adapter.action('connect_all');const engine=new Orchestrator(port,storage);await engine.create('Build the public garage booking site','repair',{team:true});
 await engine.tick();await engine.tick();return {adapter,port,storage,engine,calls:()=>calls,setResult:(value:string)=>result=value,w:()=>engine.snapshot().workflows[0]};
}
test('rejected plan is archived completely with diagnostics, hash and no duplicate execution',async()=>{
 const f=await fixture();try{const w=f.w();assert.equal(w.status,'paused');assert.equal(w.tasks[0].status,'completed');assert.equal(w.planned,false);assert.equal(w.tasks.length,1);const r=w.planRecovery!;assert.equal(r.status,'proposal_ready');assert.equal(r.responses[0].text,original);assert.equal(r.responses[0].sha256,createHash('sha256').update(original).digest('hex'));assert.equal(r.responses[0].issues[0].actual,9);assert.equal(r.responses[0].issues[0].limit,8);await assert.rejects(f.engine.command(w.id,'resume'),/diagnostics/);await f.engine.tick();assert.equal(f.calls(),1);validateWorkflowBook(f.storage.book,'mock');}finally{f.adapter.stop();}
});
test('correction preserves tasks, dependencies, acceptance and original Lead identity across restart',async()=>{
 const f=await fixture();try{const before=f.w(),candidate=before.planRecovery!.candidate!,raw=JSON.parse(original);assert.equal(candidate.filesAfter,8);assert.equal(candidate.filesBefore,9);assert.deepEqual(candidate.changes,[{from:'tests/ServiceCatalog.test.tsx',to:'tests/App.test.tsx',ownerTask:'service-experience',downstreamTask:'app-integration'}]);const corrected=JSON.parse(candidate.text);assert.deepEqual(corrected.tasks.map((t:any)=>[t.id,t.dependencies,t.acceptance]),raw.tasks.map((t:any)=>[t.id,t.dependencies,t.acceptance]));
 const restored=new Orchestrator(f.port,f.storage);assert.equal(restored.recoveryError,null);await restored.command(before.id,'apply_plan_repair');const after=restored.snapshot().workflows[0];assert.equal(after.status,'paused');assert.equal(after.planned,true);assert.deepEqual(after.tasks[0].result,before.tasks[0].result);assert.equal(after.tasks[0].executionId,before.tasks[0].executionId);assert.equal(after.planRecovery!.responses[0].text,original);assert.equal(new Set(after.tasks.flatMap(t=>t.teamSpec!.scope)).size,8);await restored.tick();assert.equal(f.calls(),1);assert.equal(new Orchestrator(f.port,f.storage).recoveryError,null);await assert.rejects(restored.command(before.id,'apply_plan_repair'));}finally{f.adapter.stop();}
});
test('invalid JSON, unsafe permissions, parallel ownership and oversized single tasks require revision',async()=>{
 const f=await fixture();try{const raw=JSON.parse(original);for(const text of ['not JSON',JSON.stringify({...raw,tasks:raw.tasks.map((t:any)=>({...t,permissions:['write']}))}),JSON.stringify({...raw,tasks:raw.tasks.map((t:any)=>t.id==='app-integration'?{...t,dependencies:[]}:t)})]){assert(diagnosePlan(text,f.w()).length);assert.equal(suggestPlanRepair(text,f.w()),null);}const one=raw.tasks[1];assert.throws(()=>parseTeamPlan(JSON.stringify({tasks:[{...one,scope:['src/a.ts','src/b.ts','src/c.ts','src/d.ts','tests/a.test.ts']}]}),f.w()),/4-file/);assert.throws(()=>parseTeamPlan(JSON.stringify({tasks:[{...one,scope:['src/A.ts','src/a.ts']}]}),f.w()),/aliased/);}finally{f.adapter.stop();}
});
test('Lead-only revision is explicit, bounded and retains earlier responses',async()=>{
 const f=await fixture('invalid JSON');try{const id=f.w().id;await f.engine.command(id,'revise_plan');assert.equal(f.w().status,'paused');assert.equal(f.calls(),1);await f.engine.tick();assert.equal(f.calls(),1);const good=JSON.stringify({tasks:[JSON.parse(original).tasks[1]]});f.setResult(good);await f.engine.command(id,'resume');await f.engine.tick();await f.engine.tick();const w=f.w();assert.equal(w.planned,true);assert.equal(w.planRecovery!.resolution,'lead_revision');assert.deepEqual(w.planRecovery!.responses.map(r=>r.text),['invalid JSON',good]);assert.equal(w.tasks[0].attempts,2);assert.equal(w.tasks[0].inputContext!.planFeedback!.response,'invalid JSON');assert(teamPlanningPrompt(w.tasks[0].inputContext!).includes('project/plan-feedback.json'));}finally{f.adapter.stop();}
});
test('legacy failure uses preserved Lead result and creates no new execution',async()=>{
 const f=await fixture();try{const w=f.storage.book.workflows[0];delete w.planRecovery;w.tasks[0].status='failed';w.tasks[0].error={kind:'permanent',message:'Result rejected: Project scope exceeds 8 files'};const engine=new Orchestrator(f.port,f.storage);await engine.command(w.id,'prepare_plan_repair');assert.equal(engine.snapshot().workflows[0].planRecovery!.responses[0].text,original);assert.equal(f.calls(),1);}finally{f.adapter.stop();}
});
test('real repair refuses an already existing source test and cross-project access',async()=>{
 const root=mkdtempSync(join(tmpdir(),'office-plan-repair-'));try{mkdirSync(join(root,'tests'));const team={projectId:'p'},actions={permissions:{boundary:{path:(p:string)=>({absolute:join(root,p)})}}};const port=new RealExecutionPort(team,actions),candidate={changes:[{from:'tests/source.test.ts'}]};port.validatePlanRepair({projectId:'p'},candidate);writeFileSync(join(root,'tests/source.test.ts'),'existing work');assert.throws(()=>port.validatePlanRepair({projectId:'p'},candidate),/existing test/);assert.throws(()=>port.validatePlanRepair({projectId:'other'},candidate),/ownership/);}finally{assert(root.startsWith(join(tmpdir(),'office-plan-repair-')));rmSync(root,{recursive:true,force:true});}
});
test('large planning responses survive summary truncation and invalid revisions stop after three Lead attempts',async()=>{
 const full=original+' '.repeat(7000),f=await fixture(full);try{assert.equal(f.w().tasks[0].result!.summary.length,6000);assert.equal(f.w().planRecovery!.responses[0].text,full);assert.equal(new Orchestrator(f.port,f.storage).recoveryError,null);}finally{f.adapter.stop();}
 const retry=await fixture('invalid JSON');try{for(let i=0;i<2;i++){await retry.engine.command('repair','revise_plan');await retry.engine.command('repair','resume');await retry.engine.tick();await retry.engine.tick();assert.equal(retry.w().status,'paused');}assert.equal(retry.calls(),3);assert.equal(retry.w().planRecovery!.responses.length,3);await assert.rejects(retry.engine.command('repair','revise_plan'),/limit/);assert.equal(retry.calls(),3);}finally{retry.adapter.stop();}
});
test('reserved gate IDs are diagnosed before graph installation and never install a partial graph',async()=>{
 const row=JSON.parse(original).tasks[1];row.id='gate-qa-0';const f=await fixture(JSON.stringify({tasks:[row]}));try{assert.equal(f.w().tasks.length,1);assert.equal(f.w().planned,false);assert.match(f.w().planRecovery!.responses[0].issues[0].message,/reserved/);assert.equal(f.w().status,'paused');}finally{f.adapter.stop();}
});
