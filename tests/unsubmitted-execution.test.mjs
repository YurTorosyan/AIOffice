import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
import {RealExecutionPort} from '../server/orchestration.mjs';import {Orchestrator} from '../src/orchestration/Orchestrator.ts';import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
const old='a'.repeat(64),current='b'.repeat(64);
function fixture(){mkdirSync('work/unsubmitted-fixtures',{recursive:true});const root=mkdtempSync(resolve('work/unsubmitted-fixtures/case-')),state={execution:'idle',taskId:null,threadId:null,turnId:null},member={state,book:{tasks:[],checkpoints:[]}},settled=[];
 const team={root,projectId:'p',maxActive:2,members:new Map([['frontend',member]]),resources:{settle:(...args)=>settled.push(args)}};
 const port=new RealExecutionPort(team,{verificationRevision:()=>current},{boundary:{path:p=>({absolute:resolve(root,p)})}}),t={id:'fix',projectId:'p',agentId:'frontend',status:'paused',error:{kind:'disconnect',message:'Runtime start outcome requires reconciliation; no duplicate start is permitted.'},executionId:'wf-fixture-fix-1',attempts:1,result:null,checkpointId:null,teamSpec:{kind:'implementation',scope:['src/App.tsx'],testEvidence:[]},inputContext:{project:{workspaceRoot:root},team:{handoffs:[{testResults:[{source:'runner',revision:old,status:'FAIL'}]}]}}};
 return {port,t,team,member,root,settled};}

test('implementation receives historical failed QA without comparing it to a narrower correction scope; gates and own receipts stay strict',()=>{
 const f=fixture();assert.doesNotThrow(()=>f.port.validateEvidence(f.t,f.t.inputContext));assert.doesNotThrow(()=>f.port.validateResult(f.t));
 for(const kind of ['qa','review','security','integration']){const t=structuredClone(f.t);t.teamSpec.kind=kind;assert.throws(()=>f.port.validateEvidence(t,t.inputContext),/stale/);assert.throws(()=>f.port.preflight(t,t.inputContext),/stale/);}
 const t=structuredClone(f.t);t.teamSpec.testEvidence=[{source:'runner',revision:old}];assert.throws(()=>f.port.validateEvidence(t,t.inputContext),/stale/);
});

test('legacy pre-submission reconciliation requires reproducible rejection and absence of all execution records',()=>{
 const f=fixture();assert.match(f.port.reconcileUnsubmitted(f.t),/before runtime submission/);assert.deepEqual(f.settled,[['wf-fixture-fix-1','failed']]);
 for(const change of [x=>x.t.projectId='foreign',x=>x.t.inputContext.project.workspaceRoot='foreign',x=>x.t.teamSpec.kind='qa',x=>x.t.error.message='unknown error',x=>x.t.status='running',x=>x.t.responseRef={},x=>x.t.checkpointId='cp',x=>x.t.result={},x=>x.t.inputContext.team.handoffs[0].testResults[0].revision=current,x=>x.member.state.execution='working',x=>x.member.state.threadId='thread',x=>x.member.state.recoveryError='storage',x=>x.member.book.tasks.push({id:x.t.executionId}),x=>x.member.book.checkpoints.push({taskId:x.t.executionId}),x=>x.member.state.taskId=x.t.executionId,x=>{const dir=resolve(x.root,'.ai-office/results');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,x.t.executionId+'--turn-known.json'),'{}');}]){const x=fixture();change(x);assert.throws(()=>x.port.reconcileUnsubmitted(x.t));assert.equal(x.settled.length,0);}
});

test('metadata reconciliation retains pause, attempts, other results and approvals without execution',async()=>{
 const adapter=new MockCodexAdapter(undefined,undefined,false),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage(),engine=new Orchestrator(port,storage);try{await engine.create('Analyze without execution','unsubmitted');await engine.command('unsubmitted','pause');const book=structuredClone(storage.book),w=book.workflows[0],t=w.tasks[0];Object.assign(t,{status:'paused',executionId:'wf-unsubmitted-plan-1',attempts:1,error:{kind:'disconnect',message:'legacy rejected'},startedAt:new Date().toISOString()});w.error=t.error.message;storage.book=book;
 let proofs=0;port.reconcileUnsubmitted=()=>{proofs++;return 'Verified fixture pre-submission rejection';};const recovered=new Orchestrator(port,storage),before=recovered.snapshot().workflows[0];await recovered.command('unsubmitted','reconcile_unsubmitted','plan');const after=recovered.snapshot().workflows[0];assert.equal(proofs,1);assert.equal(after.status,'paused');assert.equal(after.tasks[0].status,'ready');assert.equal(after.tasks[0].executionId,null);assert.equal(after.tasks[0].attempts,1);assert.equal(after.tasks[0].startedAt,before.tasks[0].startedAt);assert.equal(after.error,null);assert.equal(adapter.getTasks().length,0);assert.equal(new Orchestrator(port,storage).recoveryError,null);
 }finally{adapter.stop();}
});

