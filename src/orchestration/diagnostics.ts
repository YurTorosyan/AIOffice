import {dependencyRequirement} from './dependency-contract.ts';
import {dependencySatisfied,specificationResolved} from './team-workflow.ts';
import {contextContinuationAddressed} from './task-inputs.ts';
import {implementationHandoffReady} from './implementation-handoff.ts';
import {evidenceState} from './quality.ts';
import {lineageAttempts} from './attempt-budget.ts';
import type {Workflow} from './model.ts';
export function workflowDiagnostics(w:Workflow){
 const tasks=w.tasks.map(t=>{
  const approval=w.team?.approvals.find(a=>a.taskId===t.id&&a.status==='pending');
  const waitingFor=t.dependencies.filter(id=>!dependencySatisfied(w,t,id));
  const addressed=contextContinuationAddressed(w,t)||specificationResolved(w,t)||implementationHandoffReady(w,t)||!!t.teamSpec&&!!w.team?.gates[t.teamSpec.kind]&&w.team.gates[t.teamSpec.kind]!==t.id&&w.tasks.some(n=>n.id===w.team!.gates[t.teamSpec!.kind]&&n.teamSpec?.remediationFor.includes(t.id));
  const kind=approval?'approval':t.error?'error':addressed?'addressed':t.status==='cancelled'?'cancelled':t.status==='completed'?'completed':['running','launching'].includes(t.status)?'executing':waitingFor.length?'dependency':w.status==='paused'?'paused':'admission';
  const reason=approval?(approval.operationId?'Исход операции требует сверки или точного подтверждения':'Требуется точное подтверждение Director'):addressed?'Исходный результат сохранён; подготовлено явное продолжение':t.error?.message??(waitingFor.length?'Ожидает: '+waitingFor.join(', '):kind==='admission'?'Ожидает подключения сотрудника или свободного слота':kind==='paused'?'Требуется явное продолжение workflow':kind==='executing'?'Ожидает подтверждённого результата исполнения':t.status);
  return {taskId:t.id,kind,reason,waitingFor,addressed,dependencies:t.dependencies.map(id=>({taskId:id,requirement:dependencyRequirement(w,id),ready:dependencySatisfied(w,t,id)})),
   execution:t.status,response:t.responseRef?.contentStatus??(t.result?(w.source==='mock'?'mock':'legacy_unverified'):'not_received'),
   effect:approval?(approval.operationId?'reconcile_required':'approval_required'):w.team?.approvals.some(a=>a.taskId===t.id&&a.status==='approved')?'confirmed':'none',
   quality:evidenceState(t.teamSpec?.testEvidence??[]),attemptBudget:lineageAttempts(w,t)};
 });
 return {workflowId:w.id,status:w.status,pendingApprovals:w.team?.approvals.filter(a=>a.status==='pending').length??0,
  attention:tasks.filter(t=>['approval','error','dependency','admission','paused'].includes(t.kind)&&!t.addressed&&t.execution!=='completed').map(t=>t.taskId),tasks};
}
