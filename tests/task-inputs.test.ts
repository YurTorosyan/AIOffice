import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {buildTaskInputs,validateTaskInputs} from '../src/orchestration/task-inputs.ts';
import {dependencySatisfied,deriveTeamPhase,handoffs} from '../src/orchestration/team-workflow.ts';
import {validateWorkflowBook} from '../src/orchestration/model.ts';
import {RealExecutionPort} from '../server/orchestration.mjs';
import {TeamActions} from '../server/team-actions.mjs';

test('new handoffs reference complete reports while legacy v2 previews remain immutable',()=>{
 const evidence={source:'runner',command:'browser',status:'PASS',exitCode:0,revision:'a'.repeat(64),output:'complete diagnostic preview\n'.repeat(100),report:{version:1,id:'qa-'+ 'b'.repeat(64),sha256:'c'.repeat(64),characters:2600,complete:true},reportOwnerTaskId:'qa-original'};
 const source={id:'qa',agentId:'qa',status:'completed',dependencies:[],description:'Original criteria',teamSpec:{acceptance:['All acceptance remains'],scope:[]},result:{summary:'Current evidence',decisions:['Keep history'],warnings:[],unresolved:[],team:{verdict:'PASS',tests:[evidence],codeInfo:[],findings:[]}}};
 const w={tasks:[source],team:{approvals:[]}} as any,t={dependencies:['qa'],teamSpec:{scope:[]}} as any;
 const legacy=buildTaskInputs(w,t,2);assert.equal(legacy.handoffs[0].tests![0].output,evidence.output);
 t.inputContext={inputs:legacy};assert.doesNotThrow(()=>validateTaskInputs(w,t));
 const current=buildTaskInputs(w,t);assert.equal(current.version,3);assert(current.handoffs[0].tests![0].output.includes(evidence.report.id));assert(current.handoffs[0].tests![0].output.length<evidence.output.length);
 const directContext={inputs:current,upstream:[{taskId:'qa',result:{decisions:[],warnings:[],unresolved:[]}}]} as any;
 assert(handoffs(w,t,directContext)[0].testResults[0].output.includes(evidence.report.id));
 assert.equal(handoffs(w,t,{...directContext,inputs:legacy})[0].testResults[0].output,evidence.output);
 assert.deepEqual(current.handoffs[0].tests![0].report,evidence.report);assert.equal(current.handoffs[0].tests![0].reportOwnerTaskId,'qa-original');assert.equal(source.result.team.tests[0].output,evidence.output);
 t.inputContext={inputs:current};assert.doesNotThrow(()=>validateTaskInputs(w,t));current.handoffs[0].tests![0].output='forged reference';assert.throws(()=>validateTaskInputs(w,t));
});
async function fixture(foreign=false){
 const adapter=new MockCodexAdapter(),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage(),engine=new Orchestrator(port,storage);port.scenario='team-parallel';const original=port.teamResult.bind(port);port.teamResult=t=>{const r=original(t) as any;if(t.id==='ui'){r.team.verdict='BLOCKED';r.team.patches=[];r.summary='Missing dependency source snapshots and approved design handoff';r.team.findings=[{id:'missing-input',severity:'high',message:r.summary,responsibleTask:t.id,reproduction:'Attach approved source inputs',files:['src/team-ui.ts',foreign?'src/foreign.ts':'src/team-api.ts']}];}return r;};
 await adapter.action('connect_all');await engine.create('Build public integrated UI','inputs',{team:true});await engine.tick();for(let i=0;i<2;i++){await port.advance(engine.snapshot().workflows[0].tasks);await engine.tick();}const a=engine.snapshot().workflows[0].team!.approvals.find(a=>a.action==='apply_changes')!;await engine.command('inputs','approve_action',a.id);await engine.tick();await port.advance(engine.snapshot().workflows[0].tasks);await engine.tick();await engine.command('inputs','pause');return {adapter,port,storage,engine,w:()=>engine.snapshot().workflows[0]};
}
test('applied transitive sources and attributed design are attached without expanding write scope',async()=>{
 const f=await fixture();try{const w=f.w(),ui=w.tasks.find(t=>t.id==='ui')!,inputs=ui.inputContext!.inputs!;assert(inputs.readFiles.includes('src/team-api.ts'));assert(inputs.handoffs.some(h=>h.taskId==='design'&&h.agentId==='design'));assert(!ui.teamSpec!.scope.includes('src/team-api.ts'));assert.equal(ui.result!.team!.verdict,'BLOCKED');assert.equal(f.engine.recoveryError,null);validateWorkflowBook(f.storage.book,'mock');assert.equal(new Orchestrator(f.port,f.storage).recoveryError,null);
 const changed=structuredClone(f.storage.book);changed.workflows[0].tasks.find(t=>t.id==='ui')!.inputContext!.inputs!.readFiles.push('src/foreign.ts');assert.throws(()=>validateWorkflowBook(changed,'mock'),/approved dependency context/);
 }finally{f.adapter.stop();}
});
test('missing-input continuation preserves original response and queues only the same implementation scope',async()=>{
 const f=await fixture();try{const before=f.w(),source=before.tasks.find(t=>t.id==='ui')!,jobs=f.adapter.getTasks().length;await f.engine.command('inputs','retry_with_context','ui');const w=f.w(),next=w.tasks.find(t=>t.id==='ui-context-1')!;assert(next);assert.equal(w.status,'paused');assert.notEqual(deriveTeamPhase({...w,status:'running'}),'CHANGES_REQUIRED');assert.equal(next.executionId,null);assert.deepEqual(next.teamSpec!.scope,source.teamSpec!.scope);assert.deepEqual(w.tasks.find(t=>t.id==='ui')!.result,source.result);assert.equal(w.tasks.find(t=>t.id==='ui')!.executionId,source.executionId);assert.deepEqual(w.team!.approvals,before.team!.approvals);assert(w.tasks.find(t=>t.id===w.team!.gates.qa)!.dependencies.includes(next.id));assert(next.dependencies.every(id=>dependencySatisfied(w,next,id)));assert(buildTaskInputs(w,next).handoffs.some(h=>h.taskId==='design'));await f.engine.tick();assert.equal(f.adapter.getTasks().length,jobs);assert.equal(new Orchestrator(f.port,f.storage).recoveryError,null);await assert.rejects(f.engine.command('inputs','retry_with_context','ui'),/already prepared/);
 }finally{f.adapter.stop();}
});
test('an unrelated reference is rejected before result assignment and never poisons workflow storage',async()=>{
 const f=await fixture(true);try{const w=f.w(),ui=w.tasks.find(t=>t.id==='ui')!;assert.equal(ui.status,'failed');assert.equal(ui.result,null);assert.match(ui.error!.message,/Finding outside/);assert.equal(f.engine.recoveryError,null);validateWorkflowBook(f.storage.book,'mock');}finally{f.adapter.stop();}
});
test('real snapshots read fresh approved sources and full handoffs; baseline access gives no write permission',async()=>{
 const f=await fixture();try{const w=f.w(),t=w.tasks.find(t=>t.id==='ui')!,base=resolve('work/task-input-tests');mkdirSync(base,{recursive:true});const root=mkdtempSync(resolve(base,'project-'));mkdirSync(resolve(root,'src'));mkdirSync(resolve(root,'tests'));const text='export const fresh = 42;\n';writeFileSync(resolve(root,'src/team-api.ts'),text);const actions=new TeamActions(root),team={members:new Map([['frontend',{context:()=>[{path:'project/manifest.json',text:'original',sha256:'a'.repeat(64)}]}]])},port=new RealExecutionPort(team,actions),rows=port.contextProvider(t)();assert.equal(rows.find(r=>r.path==='src/team-api.ts')!.text,text);assert.equal(rows.find(r=>r.path==='src/team-api.ts')!.sha256,createHash('sha256').update(text).digest('hex'));const full=JSON.parse(rows.find(r=>r.path==='project/upstream-handoffs.json')!.text);assert(full.handoffs.some(h=>h.taskId==='design'));assert.deepEqual(full.writeScope,t.teamSpec!.scope);assert.equal(actions.permissions.evaluate({workflowId:w.id,taskId:t.id,agentId:t.agentId,files:t.teamSpec!.scope,baselineFiles:t.inputContext!.inputs!.readFiles,active:true},{id:'deny-write',workflowId:w.id,taskId:t.id,agentId:t.agentId,action:'file.modify',resources:['src/team-api.ts'],reason:'must remain read-only'}).decision,'denied');
 }finally{f.adapter.stop();}
});
test('missing applied dependency and a changed preflight snapshot block submission instead of masquerading as a new file',async()=>{
 const f=await fixture();try{
  const w=f.w(),t=w.tasks.find(t=>t.id==='ui')!,base=resolve('work/task-input-tests');mkdirSync(base,{recursive:true});const root=mkdtempSync(resolve(base,'admission-'));mkdirSync(resolve(root,'src'));mkdirSync(resolve(root,'tests'));
  const actions=new TeamActions(root),team={members:new Map([['frontend',{context:()=>[]}]])},port=new RealExecutionPort(team,actions);
  assert(t.inputContext!.inputs!.requiredFiles!.includes('src/team-api.ts'));assert.throws(()=>port.preflight(t,t.inputContext!),/Applied dependency input is missing/);
  writeFileSync(resolve(root,'src/team-api.ts'),'first');port.preflight(t,t.inputContext!);writeFileSync(resolve(root,'src/team-api.ts'),'changed between admission and turn submission');
  assert.throws(()=>port.contextProvider(t)(),/changed after preflight/);
 }finally{f.adapter.stop();}
});
