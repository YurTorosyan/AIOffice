import type {Workflow,WorkflowTask} from './model.ts';
export interface VerificationDeferral {qaTaskId:string;findingIds:string[];executionId:string;approvalId:string;approvedAt:string;}
/** Conservative candidate detection only. A separate Director action is always required. */
export function deferredVerificationCandidate(w:Workflow,t:WorkflowTask){
 const r=t.result?.team,qa=w.tasks.find(q=>q.id===(t.verificationDeferral?.qaTaskId??w.team?.gates.qa));
 if(!w.team||t.status!=='completed'||t.teamSpec?.kind!=='implementation'||!t.executionId||r?.verdict!=='BLOCKED'||!r.findings.length||!r.patches.length||!qa||qa.teamSpec?.kind!=='qa'||!qa.dependencies.includes(t.id))return null;
 if(r.findings.some(f=>!['medium','low'].includes(f.severity)||f.responsibleTask!==t.id||!f.files.length||f.files.some(p=>!t.teamSpec!.scope.includes(p))||!/\b(browser|test|verification|build|checks)\b/i.test(f.message)||!/\bnot (?:been )?(?:performed|run|executed)\b/i.test(f.message)||/\b(failed|fails|failure|defect|vulnerability|regression|broken|mismatch|incorrect)\b/i.test(f.message)))return null;
 const approval=w.team.approvals.find(a=>a.taskId===t.id&&a.action==='apply_changes'&&a.status==='approved'&&a.revision&&JSON.stringify(a.patches)===JSON.stringify(r.patches)&&JSON.stringify(t.result!.filesChanged)===JSON.stringify(a.patches.map(p=>p.path)));
 return approval?{qa,approval,findings:r.findings}:null;
}
export function implementationHandoffReady(w:Workflow,t:WorkflowTask){
 const d=t.verificationDeferral,c=deferredVerificationCandidate(w,t);return !!d&&!!c&&d.executionId===t.executionId&&d.approvalId===c.approval.id&&JSON.stringify(d.findingIds)===JSON.stringify(c.findings.map(f=>f.id))&&w.tasks.some(q=>q.id===d.qaTaskId&&q.teamSpec?.kind==='qa'&&q.dependencies.includes(t.id));
}
export function validateVerificationDeferral(w:Workflow,t:WorkflowTask){
 const d=t.verificationDeferral;if(!d)return;
 if(Object.keys(d).sort().join(',')!=='approvalId,approvedAt,executionId,findingIds,qaTaskId'||!Array.isArray(d.findingIds)||new Set(d.findingIds).size!==d.findingIds.length||typeof d.approvedAt!=='string'||!Number.isFinite(Date.parse(d.approvedAt))||!implementationHandoffReady(w,t))throw new Error('Invalid verification deferral; original blocked result and approved receipt required');
 if(w.status==='completed'){
  const qa=w.tasks.find(q=>q.id===w.team?.gates.qa),e=qa?.teamSpec?.testEvidence;
  if(qa?.status!=='completed'||qa.result?.team?.verdict!=='PASS'||!e?.length||e.some(r=>r.status!=='PASS'||r.source!==(w.source==='codex'?'runner':'mock'))||!w.team?.approvals.some(a=>a.taskId===qa.id&&a.action==='run_tests'&&a.status==='approved'&&a.revision&&e.every(r=>r.revision===a.revision)))throw new Error('Deferred verification needs approved passing QA evidence before completion');
 }
}
