import type {Workflow} from './model.ts';
export type ResourceObservation='before'|'after'|'conflict';
export function classifyResource(before:string|null,after:string,current:string|null):ResourceObservation{return current===after?'after':current===before?'before':'conflict';}
export function cancellationRestorePlan(w:Workflow){
 if(w.status!=='cancelled')throw new Error('Cancelled workflow required');
 if(w.team?.approvals.some(a=>a.status==='pending'))throw new Error('Cancelled workflow has unresolved approvals');
 const restore=w.tasks.filter(t=>t.status==='cancelled');if(!restore.length)throw new Error('No cancelled work to restore');
 const pending=restore.filter(t=>!t.executionId&&!t.attempts&&!t.result&&!t.startedAt&&!t.error);
 const results=restore.filter(t=>t.executionId&&t.result);
 const reconcile=restore.filter(t=>!pending.includes(t)&&!results.includes(t));
 return {workflowId:w.id,taskIds:pending.map(t=>t.id),resultTaskIds:results.map(t=>t.id),reconcileTaskIds:reconcile.map(t=>t.id),status:'paused' as const};
}
