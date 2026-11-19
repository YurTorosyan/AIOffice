import {existsSync,readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {classifyResource} from '../src/orchestration/recovery.ts';
import {operationFingerprint} from './operation-store.mjs';
/** Pure observation of owned files. No write, process start, container stop or permission grant. */
export function inspectOperation(store,id,owner){
 const row=store.get(id);if(owner.projectId!==row.projectId||owner.workflowId!==row.workflowId||owner.taskId!==row.taskId)throw new Error('Foreign operation inspection');
 const resources=row.resources.map(r=>{const file=store.boundary.path(r.path).absolute;if(existsSync(file)&&!lstatSync(file).isFile())throw new Error('Operation resource is not a regular file');const current=existsSync(file)?createHash('sha256').update(readFileSync(file)).digest('hex'):null;return {...r,current,observation:classifyResource(r.before,r.after,current)};});
 const state=row.state==='completed'?'completed':resources.some(r=>r.observation==='conflict')?'conflict':row.action==='run_tests'?'unknown':resources.every(r=>r.observation==='after')?'metadata_only':'remaining_approval';
 return {operationId:id,projectId:row.projectId,workflowId:row.workflowId,taskId:row.taskId,state,resources,receipt:row.receipt,planHash:operationFingerprint({revision:row.revision,resources}),requiresExplicitConfirmation:state!=='completed',containers:row.containers};
}
