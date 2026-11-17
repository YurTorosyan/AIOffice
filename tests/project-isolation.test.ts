import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MockProjects} from '../src/projects/MockProjects.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MemoryCheckpointStorage} from '../src/checkpoints/model.ts';
import {TaskSystem} from '../src/tasks/TaskSystem.ts';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {validateWorkflowBook} from '../src/orchestration/model.ts';
const memory=()=>{const rows=new Map<string,string>();return {getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>{rows.set(key,value);}};};
function projects(){const store=memory(),catalog=new MockProjects(store);for(const id of ['alpha','beta'])catalog.command({action:'create',projectId:id,name:id,workspaceRoot:'mock://'+id});catalog.command({action:'switch',projectId:'alpha'});return {store,catalog,context:catalog.snapshot().activeContext!};}

test('Mock project selection, archive and repository approvals persist metadata without real Git',async()=>{
 const {catalog,store}=projects();const plan=await catalog.git({projectId:'alpha',action:'prepare',operation:'checkout',branch:'feature'});
 assert.equal(catalog.snapshot().activeContext!.currentBranch,'main');const result=await catalog.git({projectId:'alpha',action:'approve',requestId:plan.record!.request.id});assert.equal(result.simulated,true);
 assert.equal(catalog.snapshot().activeContext!.currentBranch,'feature');assert.equal(new MockProjects(store).snapshot().activeProjectId,'alpha');
 catalog.command({action:'switch',projectId:'beta'});assert.equal(catalog.snapshot().activeContext!.currentBranch,'main');await assert.rejects(catalog.git({projectId:'alpha',action:'read',view:'status'}),/mismatch/);
 await assert.rejects(catalog.git({projectId:'beta',action:'prepare',operation:'force_push'}));catalog.command({action:'archive',projectId:'beta'});assert.equal(catalog.snapshot().activeProjectId,null);catalog.command({action:'reactivate',projectId:'beta'});assert.equal(catalog.snapshot().activeProjectId,null);
});

test('Task queries filter project, employee, priority, workflow and time; restoration rejects a foreign task',()=>{
 const system=new TaskSystem('alpha','main'),id=system.dispatch({type:'create',title:'Alpha',description:'Owned task',priority:'high'},'2026-11-17T10:00:00Z')!;
 system.dispatch({type:'assign',taskId:id,agentId:'backend'},'2026-11-17T10:01:00Z');
 assert.equal(system.query({projectId:'alpha',agentId:'backend',status:'pending',priority:'high',updatedAfter:'2026-11-17T10:00:30Z',createdBefore:'2026-11-17T11:00:00Z'}).length,1);
 assert.equal(system.query({projectId:'beta'}).length,0);assert.equal(system.query({workflowId:'other'}).length,0);assert.throws(()=>system.query({createdAfter:'bad'}));
 assert.throws(()=>new TaskSystem('beta').restoreTask(system.getSnapshot().tasks[0]),/project/i);assert(system.getSnapshot().activity.every(e=>e.projectId==='alpha'&&e.branch==='main'));
});

test('Mock checkpoint restores only its project/workspace and original task, never a foreign project',async()=>{
 const {context}=projects(),storage=new MemoryCheckpointStorage(),a=new MockCodexAdapter(storage,context,false);a.startOrchestrated('backend','wf-own-build-1','Owned backend task','Read only','own');a.pauseTask('wf-own-build-1');
 const restored=new MockCodexAdapter(storage,context,false);assert.equal(restored.getTasks()[0].status,'paused');assert.equal(restored.getRuntime().projectId,'alpha');restored.resumeTask('wf-own-build-1');assert.equal(restored.getTasks()[0].id,'wf-own-build-1');
 const foreign=new MockCodexAdapter(storage,{...context,projectId:'beta',workspaceRoot:'mock://beta'},false);assert(foreign.getRecoveryError());await assert.rejects(foreign.action('resume',{projectId:'alpha',taskId:'wf-own-build-1'}),/mismatch/);
 const moved=new MockCodexAdapter(storage,{...context,workspaceRoot:'mock://moved'},false);assert(moved.getRecoveryError());a.stop();restored.stop();
});

test('Orchestrator scopes graph/context/events and preserves foreign workflow storage on rejection',async()=>{
 const {context}=projects(),adapter=new MockCodexAdapter(undefined,context,false),storage=new MemoryWorkflowStorage('mock'),engine=new Orchestrator(new MockExecutionPort(adapter),storage,context);
 await engine.create('Analyze source without changes','graph');await engine.tick();const book=engine.snapshot();assert.equal(book.workflows[0].projectId,'alpha');assert(book.workflows[0].tasks.every(t=>t.projectId==='alpha'));assert(book.events.every(e=>e.projectId==='alpha'));assert.equal(book.workflows[0].rootTaskId,'plan');assert(book.workflows[0].currentStage);
 await engine.command('graph','pause');engine.updateProjectContext({...context,currentBranch:'other'});await assert.rejects(engine.command('graph','resume'),/branch changed/);
 const old=JSON.stringify(storage.load()),foreign=new Orchestrator(new MockExecutionPort(new MockCodexAdapter(undefined,{...context,projectId:'beta'},false)),storage,{...context,projectId:'beta'});assert(foreign.recoveryError);assert.equal(JSON.stringify(storage.load()),old);await assert.rejects(foreign.create('Foreign','other'));
 const mixed=structuredClone(book);mixed.workflows[0].tasks[0].projectId='beta';assert.throws(()=>validateWorkflowBook(mixed,'mock'),/Foreign/);adapter.stop();
});

test('Mock full task storage preserves completed/pending tasks and pauses interrupted manual execution on reload',()=>{
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=memory();
 Object.defineProperty(globalThis,'window',{configurable:true,value:{}});Object.defineProperty(globalThis,'localStorage',{configurable:true,value:store});
 try{const {context}=projects(),a=new MockCodexAdapter(undefined,context);const id=a.dispatch({type:'create',title:'Persist Alpha',description:'Owned',priority:'normal'})!;a.dispatch({type:'assign',taskId:id,agentId:'frontend'});a.dispatch({type:'transition',taskId:id,status:'in_progress'} as any);
  const restored=new MockCodexAdapter(undefined,context);assert.equal(restored.getRecoveryError(),null);assert.equal(restored.getTasks()[0].status,'paused');assert.equal(restored.getCheckpoints()[0].projectId,'alpha');const b=new MockCodexAdapter(undefined,{...context,projectId:'beta',workspaceRoot:'mock://beta'});assert.equal(b.getTasks().length,0);restored.stop();a.stop();b.stop();
 }finally{if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');}
});
