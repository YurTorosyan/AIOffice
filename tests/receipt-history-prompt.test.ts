import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teamTaskPrompt} from '../src/orchestration/team-workflow.ts';
import {inputContract} from '../src/orchestration/input-contract.ts';
import {orchestratedPromptLimit} from '../src/orchestration/prompt-budget.ts';
import type {WorkflowTask,Context} from '../src/orchestration/model.ts';

test('receipt-rich Security uses snapshot references without dropping any authoritative evidence',()=>{
 const scope=['src/App.tsx','src/styles.css','tests/App.test.tsx'];
 const spec={kind:'security' as const,acceptance:['Inspect current source and complete runner evidence'],scope,round:2,remediationFor:[],checksApproved:false,testEvidence:[]};
 const t={id:'security-current',title:'Independent security verification',description:'Read complete diagnostics and all attributed operations',agentId:'security',dependencies:['implementation','qa'],teamSpec:spec} as WorkflowTask;
 const handoffs=['implementation','qa'].map(sourceTaskId=>({id:'handoff-'+sourceTaskId,sourceEmployee:sourceTaskId==='qa'?'qa':'frontend',targetEmployee:'security',taskId:t.id,workflowId:'workflow',sourceTaskId,objective:t.description,completedWork:['Prepared source'],decisions:['Preserve completed work'],changedFiles:scope,codeInfo:[],warnings:[],unresolved:[],nextAction:'Independent review',createdAt:'2026-11-21T00:00:00.000Z',gateVerdict:'FAIL' as const,actionReceipts:Array.from({length:24},(_,i)=>({id:'approval-'+sourceTaskId+'-'+i+'-retained-operation',taskId:sourceTaskId,action:'apply_changes' as const,status:i===23?'approved' as const:'rejected' as const,revision:'a'.repeat(64)})),testResults:['Vitest','Build','Playwright Chromium'].map(command=>({command,status:'FAIL' as const,exitCode:1,revision:'b'.repeat(64),source:'runner' as const,output:'Complete assertion, locator and stack\n'+'diagnostic line\n'.repeat(100)}))}));
 const c={rootTask:'Verify the full application',workflowId:'workflow',taskId:t.id,upstream:[],team:{spec,handoffs}} as Context;
 const original=structuredClone(c),contract=inputContract(t,c),prompt=teamTaskPrompt(t,c);
 assert(prompt.length<=orchestratedPromptLimit);const preview=JSON.parse(prompt.slice(prompt.lastIndexOf('Task=')+5));
 assert.equal(preview.referenceOnly,true);assert.equal(preview.completeContract,'project/task-contract.json');assert.equal(preview.completeHandoffs,'project/upstream-handoffs.json');assert.deepEqual(preview.scope,scope);assert.deepEqual(preview.handoffReferences.map((h:any)=>h.sourceTaskId),['implementation','qa']);
 assert.deepEqual(c,original);assert.equal(inputContract(t,c),contract);const complete=JSON.parse(contract);assert.equal(complete.team.handoffs[0].actionReceipts.length,24);assert.equal(complete.team.handoffs[1].testResults.length,3);assert.equal(complete.team.handoffs[1].testResults[2].output,handoffs[1].testResults[2].output);
});

test('complete input budget still fails closed instead of silently truncating a large reference-only contract',()=>{
 const t={id:'security',title:'Security',description:'Scoped review',agentId:'security',dependencies:[],teamSpec:{kind:'security',scope:[],acceptance:[],round:0,remediationFor:[],checksApproved:false,testEvidence:[]}} as unknown as WorkflowTask;
 const c={rootTask:'x'.repeat(110000),workflowId:'workflow',taskId:t.id,upstream:[]} as Context;
 assert.throws(()=>inputContract(t,c),/Complete task contract exceeds input budget/);
});
