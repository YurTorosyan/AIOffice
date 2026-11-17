import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {WorkflowFileStorage} from '../server/orchestration.mjs';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {WorkspaceBoundary} from '../server/permissions.mjs';
test('legacy workflow migration retains exact original backup, tasks and project association without execution',async()=>{
 const memory=new MemoryWorkflowStorage('codex'),port={source:'codex',maxActive:2,availability:()=>({})},oldEngine=new Orchestrator(port,memory);await oldEngine.create('Preserve this request','old');const legacy=memory.load();for(const w of legacy.workflows){delete w.rootTaskId;delete w.currentStage;for(const t of w.tasks){delete t.projectId;delete t.branch;delete t.updatedAt;}}for(const e of legacy.events){delete e.projectId;delete e.branch;}
 mkdirSync('work/migration-tests',{recursive:true});const root=mkdtempSync(resolve('work/migration-tests/fixture-'));mkdirSync(resolve(root,'.ai-office'));const file=resolve(root,'.ai-office/workflows.json'),original=JSON.stringify(legacy);writeFileSync(file,original);const engine=new Orchestrator(port,new WorkflowFileStorage(root));assert.equal(engine.recoveryError,null);assert.equal(engine.snapshot().workflows[0].status,'paused');assert.equal(engine.snapshot().workflows[0].tasks[0].id,'plan');assert.equal(readFileSync(file+'.pre-stage8.bak','utf8'),original);assert.equal(engine.snapshot().workflows[0].projectId,'office-demo');
});
test('recreated path is not the same workspace and cannot redirect a retained permission boundary',()=>{
 mkdirSync('work/identity-tests',{recursive:true});const base=mkdtempSync(resolve('work/identity-tests/fixture-')),root=resolve(base,'workspace');mkdirSync(root);const boundary=new WorkspaceBoundary(root);renameSync(root,resolve(base,'moved'));mkdirSync(root);assert.throws(()=>boundary.path('README.md'),/changed|identity|workspace/i);
});
