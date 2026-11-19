import {workflowDiagnostics} from './diagnostics.ts';
import {lineageAttempts} from './attempt-budget.ts';
import {cancellationRestorePlan} from './recovery.ts';
import {buildTaskInputs,contextRetryCandidate} from './task-inputs.ts';
import {validateTeamIntegrity} from './team-workflow.ts';
import {deferredVerificationCandidate} from './implementation-handoff.ts';
import {rejectedPlan,acceptedLeadRevision,suggestPlanRepair} from './plan-recovery.ts';
import {applyLeadResolution,specificationBlockers,specificationAddressed} from './team-workflow.ts';
import type {ProjectContext} from '../projects/model.ts';
import {refinePendingImpacts,collectTeamResult,dependencySatisfied,deriveTeamPhase,finalResult,gatePass,handoffs,parseTeamPlan,roundGates,teamState,gateTask} from './team-workflow.ts';
import type {Approval,TeamSpec} from './team-workflow.ts';
import { buildContext, capabilities, clean, collectResult, emptyWorkflows, identifier, parsePlan, planningTask, selectEmployee, validatePlan, validateWorkflowBook } from './model.ts';
import type { ExecutionPort, PlanTask, Workflow, WorkflowBook, WorkflowStorage, WorkflowTask, Problem } from './model.ts';

/** Persist intentions BEFORE side effects. A single serialized scheduler owns all graph transitions. */
export class Orchestrator {
 private book:WorkflowBook; private tail:Promise<unknown>=Promise.resolve();private savedJSON='';
 recoveryError:string|null=null;private storageIssue:{code:string;phase:string;outcome:string}|null=null;private lastSavedAt:string|null=null;
 constructor(privatePort:ExecutionPort,privateStorage:WorkflowStorage,project?:ProjectContext) {
  this.project=project;this.port=privatePort;this.storage=privateStorage;this.book=emptyWorkflows(this.port.source);
  try { this.book=validateWorkflowBook(this.storage.load(),this.port.source);
   if(this.book.workflows.some(w=>w.projectId!==(this.project?.projectId??'office-demo')||w.tasks.some(t=>t.inputContext?.project&&t.inputContext.project.workspaceRoot!==this.project?.workspaceRoot)))throw new Error('Workflow project/workspace mismatch');
   for(const w of this.book.workflows)if(!['completed','cancelled'].includes(w.status)){this.routeBlockers(w);const refined=refinePendingImpacts(w);if(refined.length)this.event(w,'optional_gates_refined',null,`Removed unstarted optional gates: ${refined.join(', ')}`);w.status='paused';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:'Application restart; reconcile execution IDs before explicit resume'};for(const task of w.tasks)if(task.resource){delete task.resource.retryAt;task.resource.retry.automatic=false;}for(const t of w.tasks)if(['launching','running'].includes(t.status)){t.status='paused';t.error={kind:'disconnect',message:'Restart: existing execution will be reconciled, never blindly started again'};}}
   this.save();
  }catch {this.book=emptyWorkflows(this.port.source);this.recoveryError='Workflow storage invalid or unavailable. Original data preserved; execution blocked.';}
 }
 private project?:ProjectContext;
 private port:ExecutionPort; private storage:WorkflowStorage;
 private now(){return new Date().toISOString();}
 updateProjectContext(context:ProjectContext){if(context.projectId!==(this.project?.projectId??'office-demo')||this.project&&context.workspaceRoot!==this.project.workspaceRoot)throw new Error('Workflow project/workspace mismatch');this.project=context;}
 snapshot(){return {projectId:this.project?.projectId??'office-demo',...structuredClone(this.book),diagnostics:this.book.workflows.map(workflowDiagnostics),...(this.port.resources?{resources:{...this.port.resources.snapshot(),queuedTasks:this.book.workflows.filter(w=>w.status==='running').flatMap(w=>w.tasks).filter(t=>['pending','ready'].includes(t.status)).length}}:{}),recoveryError:this.recoveryError,...(this.storageIssue?{storageIssue:structuredClone(this.storageIssue)}:{}),lastSavedAt:this.lastSavedAt};}
 private save(){const prior=this.savedJSON?JSON.parse(this.savedJSON):null;for(const w of this.book.workflows)for(const t of w.tasks){const old=prior?.workflows.find((v:Workflow)=>v.id===w.id)?.tasks.find((v:WorkflowTask)=>v.id===t.id);if(!t.updatedAt)t.updatedAt=t.completedAt??t.startedAt??t.createdAt;else if(old&&JSON.stringify({...old,updatedAt:null})!==JSON.stringify({...t,updatedAt:null}))t.updatedAt=this.now();}for(const w of this.book.workflows){if(w.team)w.team.state=deriveTeamPhase(w);w.currentStage=w.team?.state??w.status;w.rootTaskId??='plan';}if(this.recoveryError)throw new Error(this.recoveryError);try{const json=JSON.stringify(this.book);if(json===this.savedJSON)return;this.storage.save(validateWorkflowBook(this.book,this.port.source));this.savedJSON=json;this.lastSavedAt=this.now();this.storageIssue=null;}catch(error){if(this.savedJSON)this.book=JSON.parse(this.savedJSON);const failure=error as Error&{code?:string;phase?:string;outcome?:string};this.storageIssue={code:failure.code??'WORKFLOW_VALIDATION',phase:failure.phase??'validate',outcome:failure.outcome??'not_committed'};this.recoveryError='Workflow checkpoint could not be saved; execution blocked. Repair storage before continuing.';throw new Error(this.recoveryError);}}
 private serial<T>(fn:()=>Promise<T>,allowRecovery=false):Promise<T>{const p=this.tail.then(()=>{if(this.recoveryError&&!allowRecovery)throw new Error(this.recoveryError);return fn();});this.tail=p.catch(()=>{});return p;}
 private event(w:Workflow,type:string,t:WorkflowTask|null,message:string){this.book.events.push({projectId:w.projectId,branch:this.project?.currentBranch??null,id:crypto.randomUUID(),type,workflowId:w.id,taskId:t?.id??null,agentId:t?.agentId??'lead',message,timestamp:this.now(),source:this.port.source});this.book.events=this.book.events.slice(-1000);}
 private task(p:PlanTask):WorkflowTask{const copy=structuredClone(p) as WorkflowTask;delete copy.resource;delete copy.verificationDeferral;delete copy.proposalRecovery;delete copy.responseRef;return {...copy,projectId:this.project?.projectId??'office-demo',branch:this.project?.currentBranch??null,agentId:capabilities[p.type].agentId,status:'pending',inputContext:null,result:null,error:null,executionId:null,attempts:0,checkpointId:null,createdAt:this.now(),startedAt:null,completedAt:null};}
 create(rootTask:string,requestId:string,options:{team?:boolean;maxCycles?:number}={}):Promise<string>{return this.serial(async()=>{
  identifier(requestId);if(requestId.length>48)throw new Error('Workflow ID too long');const root=clean(rootTask),existing=this.book.workflows.find(w=>w.id===requestId);
  if(existing){if(existing.rootTask!==root)throw new Error('Request ID reused with different task');return existing.id;}
  if(this.book.workflows.length>=30)throw new Error('Workflow history capacity reached');
  if(this.book.workflows.some(w=>!['cancelled','completed'].includes(w.status)))throw new Error('Finish or cancel the current workflow first');
  const w:Workflow={id:requestId,projectId:this.project?.projectId??'office-demo',rootTaskId:'plan',currentStage:'PLANNING',source:this.port.source,rootTask:root,status:'running',priority:'normal',tasks:[this.task({...planningTask,...(options.team?{teamSpec:{kind:'specification',acceptance:['Create a scoped team implementation plan'],scope:[],round:0,remediationFor:[],checksApproved:false,testEvidence:[]} as TeamSpec}:{})})],planned:false,error:null,createdAt:this.now(),startedAt:this.now(),completedAt:null,checkpoint:null,...(options.team?{team:teamState(options.maxCycles)}:{})};
  this.book.workflows.push(w);this.event(w,'workflow_created',null,w.team?'Director started an approval-controlled development workflow':'Director started a read-only team workflow');this.save();return w.id;
 });}
 private get(id:string){identifier(id);const w=this.book.workflows.find(w=>w.id===id);if(!w)throw new Error('Unknown workflow');return w;}
 private branchMatches(w:Workflow){return !this.project||w.tasks.every(t=>t.branch===undefined||t.branch===this.project!.currentBranch);}
 private issue(w:Workflow,t:WorkflowTask,kind:Problem,message:string){t.error={kind,message};t.status=kind==='permanent'||kind==='recoverable'?'failed':'paused';this.event(w,kind==='approval'?'approval_requested':t.status==='failed'?'task_failed':'task_paused',t,message);w.error=message;w.status='pausing';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:kind};}
 private installPlan(w:Workflow,text:string){
  const staged=structuredClone(w),parsed=w.team?parseTeamPlan(text,staged):null,plan=parsed?.tasks??parsePlan(text);staged.tasks.push(...plan.map(p=>this.task(p)));
  if(staged.team&&parsed){staged.team.impacts=parsed.impacts;staged.tasks.push(...roundGates(staged,plan.filter(p=>(p as any).teamSpec?.kind==='implementation').map(p=>p.id),0).map(p=>this.task(p)));}
  staged.planned=true;delete staged.planRecovery;validateWorkflowBook({...emptyWorkflows(this.port.source),workflows:[staged]},this.port.source);w.tasks.push(...staged.tasks.slice(w.tasks.length));if(staged.team)w.team=staged.team;w.planned=true;this.event(w,'plan_generated',null,`Validated dependency graph: ${w.tasks.length-1} tasks`);for(const t of w.tasks.filter(t=>t.id!=='plan')){this.event(w,'employee_selected',t,`${t.agentId}: relevant role and Skills`);this.event(w,'task_assigned',t,`${t.title} → ${t.agentId}`);}
 }
 private approval(w:Workflow,t:WorkflowTask,action:Approval['action']){
  if(w.team!.approvals.some(a=>a.taskId===t.id&&a.status==='pending'))return;
  w.team!.approvals.push({id:crypto.randomUUID(),taskId:t.id,employeeId:t.agentId,action,reason:action==='apply_changes'?'Применить показанные изменения в текущем проекте после проверки diff':'Запустить показанные изолированные проверки в текущем проекте. Сначала проверьте согласованный код.',status:'pending',requestedAt:this.now(),resolvedAt:null,patches:action==='apply_changes'?structuredClone(t.result!.team!.patches):[],previous:action==='apply_changes'?(this.port.preview?.(t)??Object.fromEntries(t.result!.team!.patches.map(p=>[p.path,null]))):{},commands:action==='run_tests'?(this.port.approvalCommands?.(t)??[`node --experimental-strip-types --test ${t.teamSpec!.scope.filter(p=>p.startsWith('tests/')).join(' ')||'(no test files: BLOCKED)'}`]):[],revision:null});
  const approval=w.team!.approvals.at(-1)!;approval.security=this.port.prepareApproval?.(w,t,approval);
  t.status='paused';this.event(w,'approval_requested',t,`${action}: explicit Director approval required`);
 }
 private remediate(w:Workflow){
  if(!w.team||w.status!=='running')return;const s=w.team,checks=Object.entries(s.gates).filter(([k])=>['qa','security','seo'].includes(k)).map(([,id])=>w.tasks.find(t=>t.id===id)!);
  const review=w.tasks.find(t=>t.id===s.gates.review),integration=w.tasks.find(t=>t.id===s.gates.integration),failed=checks.filter(t=>t.status==='completed'&&!gatePass(t));if(review?.status==='completed'&&!gatePass(review))failed.push(review);if(integration?.status==='completed'&&!gatePass(integration))failed.push(integration);
  if(!failed.length||checks.some(t=>t.status!=='completed'))return;
  for(const t of failed)this.event(w,t.teamSpec!.kind==='qa'?'qa_failed':t.teamSpec!.kind==='security'?'security_blocker':'review_rejected',t,t.result!.team!.verdict);
  if(s.round>=s.maxCycles){w.status='paused';w.error=s.round>=s.maxCycles?'Remediation cycle limit reached; Director intervention required':'Gate BLOCKED; resolve missing permissions/evidence before continuing';return;}
  const owners=new Set<string>();for(const t of failed)for(const f of t.result!.team!.findings){const owner=w.tasks.find(x=>x.id===f.responsibleTask&&x.teamSpec?.kind==='implementation');if(owner)owners.add(owner.id);}
  if(!owners.size){w.status='paused';w.error='Findings need a valid responsible implementation task; no guessed reassignment';return;}
  const next=s.round+1,fixes=[...owners].map((id,i)=>{const old=w.tasks.find(t=>t.id===id)!;const p={...old,id:`fix-${next}-${i}`,title:`Fix ${old.title}`.slice(0,160),description:'Remediate attributed gate findings within the same approved scope. '+old.description,dependencies:failed.map(t=>t.id),teamSpec:{...structuredClone(old.teamSpec!),round:next,remediationFor:failed.map(t=>t.id),checksApproved:false,testEvidence:[]}};return this.task(p);});
  // Only gates not yet started become obsolete. Completed verdicts remain immutable history.
  for(const id of Object.values(s.gates)){const t=w.tasks.find(t=>t.id===id)!;if(['pending','ready'].includes(t.status))t.status='cancelled';}
  s.round=next;w.tasks.push(...fixes);w.tasks.push(...roundGates(w,fixes.map(t=>t.id),next).map(p=>this.task(p)));this.event(w,'remediation_created',null,`Bounded corrective round ${next}/${s.maxCycles}`);if(failed.some(t=>t.result!.team!.verdict==='BLOCKED'||t.result!.team!.findings.some(f=>f.severity==='critical'))){w.status='paused';w.error='Critical or BLOCKED finding: corrective tasks preserved, explicit Director resume required';}
 }
 private routeBlockers(w:Workflow){
  if(!w.team||!w.planned||['completed','cancelled'].includes(w.status))return;
  for(const task of w.tasks.filter(t=>t.teamSpec?.kind==='resolution'&&t.status==='completed'&&!t.teamSpec.resolutionApplied)){
   try{const retry=applyLeadResolution(w,task);if(retry)w.tasks.push(this.task(retry));const decision=task.result!.team!.resolution!;this.event(w,'blocker_resolved',task,decision.reason);if(decision.action==='director_required'){w.status='pausing';w.error='Lead требует решения Director: '+decision.reason;}}
   catch(e){task.status='failed';task.error={kind:'permanent',message:'Lead resolution rejected: '+(e as Error).message};w.status='pausing';w.error='Lead resolution requires Director: '+(e as Error).message;this.event(w,'blocker_resolution_failed',task,w.error);}
  }
  for(const source of specificationBlockers(w)){
   const existing=w.tasks.find(t=>t.teamSpec?.kind==='resolution'&&t.teamSpec.remediationFor.includes(source.id));if(existing)continue;
   const count=w.tasks.filter(t=>t.teamSpec?.kind==='resolution').length,limit=Math.min(3,w.team.maxCycles+1);
   if(count>=limit||w.tasks.length>=80){if(!['paused','pausing'].includes(w.status))w.status='pausing';w.error='Достигнут лимит согласований Lead; требуется решение Director';continue;}
   let n=count+1;while(w.tasks.some(t=>t.id===`lead-blocker-${n}`))n++;
   const scope=[...new Set([...source.teamSpec!.scope,...w.tasks.filter(t=>t.teamSpec?.kind==='implementation'&&t.dependencies.includes(source.id)).flatMap(t=>t.teamSpec!.scope)])];
   const next=this.task({id:`lead-blocker-${n}`,title:`Lead: согласовать блокер «${source.title}»`.slice(0,160),description:'Resolve the completed but blocked design handoff; preserve the original result and choose a structured safe next step. '+(source.result?.team?.nextAction??'').slice(0,900),type:'planning',dependencies:[source.id],requiredSkills:['planning-and-task-breakdown'],priority:'high',permissions:['read-only'],teamSpec:{kind:'resolution',acceptance:['Resolve the source design blocker or request an explicit Director decision'],scope,round:w.team.round,remediationFor:[source.id],checksApproved:false,testEvidence:[]}} as PlanTask);
   w.tasks.push(next);w.status='pausing';w.error='Дизайнер вернул '+source.result!.team!.verdict+'. Подготовлена задача Lead; продолжение требует явного возобновления workflow.';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:'Specification blocker routed to Lead; no automatic Codex execution'};this.event(w,'blocker_escalated',source,w.error);
  }
 }
 private async observe(w:Workflow){
  for(const t of w.tasks.filter(t=>t.executionId&&['launching','running','paused'].includes(t.status))){
   if(w.team?.approvals.some(a=>a.taskId===t.id&&a.status==='pending'))continue;
   const e=this.port.read(t);if(e.responseRef)t.responseRef=structuredClone(e.responseRef);t.checkpointId=e.checkpointId??t.checkpointId;
   if(e.status==='completed'){
    try{if(t.id!=='plan')this.port.archiveResult?.(t,e.result??'');if(w.team)this.port.validateResult?.(t);const candidate=w.team&&t.id!=='plan'?collectTeamResult(e.result??'',t):collectResult(e.result??'');if(w.team&&t.id!=='plan'){const staged=structuredClone(w);staged.tasks.find(x=>x.id===t.id)!.result=candidate;validateTeamIntegrity(staged);}t.result=candidate;if(t.id==='plan'&&!w.planned){const raw=e.result??'';try{const accepted=w.planRecovery?.status==='revision_ready'?await acceptedLeadRevision(raw,w,t.executionId!):null;this.installPlan(w,raw);if(accepted)w.planRecovery=accepted;}catch(error){if(!w.team)throw error;w.planRecovery=await rejectedPlan(raw,w,t.executionId!,w.planRecovery);t.status='completed';t.error=null;t.completedAt=this.now();w.status='paused';w.error='План требует согласования: '+w.planRecovery.responses.at(-1)!.issues.map(i=>i.message).join('; ');this.event(w,'plan_validation_rejected',t,w.error);continue;}}t.status='completed';t.error=null;t.completedAt=this.now();if(w.team&&t.result.team?.patches.length){this.event(w,'proposal_created',t,`${t.title}: model proposal awaits Director approval`);this.approval(w,t,'apply_changes');}else this.event(w,'task_completed',t,`${t.title}: runtime confirmed completion`);}
    catch(error){this.issue(w,t,'permanent',`Result rejected: ${(error as Error).message}`);}
   }else if(e.status==='failed'&&t.status!=='failed'){this.issue(w,t,e.kind??'recoverable',clean(e.error??'Execution failed',1000));if(t.resource&&this.port.resources){t.resource.retry=this.port.resources.retry(t.executionId!,e.failureClass??'UNKNOWN',lineageAttempts(w,t).attempts);if(lineageAttempts(w,t).attempts>=3)t.resource.retry.automatic=false;if(t.resource.retry.automatic)t.resource.retryAt=new Date(Date.now()+1000*Math.min(t.attempts,5)).toISOString();}}
   else if(e.status==='approval'&&t.error?.kind!=='approval')this.issue(w,t,'approval','Runtime requests additional permission. Read-only policy cannot be widened; reject request before continuing.');
   else if(e.status==='paused'&&t.status!=='paused')this.issue(w,t,e.kind??'pause',e.error??'Employee checkpoint preserved');
   else if(e.status==='missing'&&t.status!=='paused')this.issue(w,t,'disconnect','Execution could not be reconciled. No duplicate start; Director intervention required.');
   else if(e.status==='running'&&t.status==='launching'){t.status='running';this.event(w,'task_started',t,`${t.title}: runtime started`);}
  }
 }
 private async stopActive(w:Workflow,cancel=false){
  let unconfirmed=false;
  for(const t of w.tasks.filter(t=>t.executionId&&['running','launching','paused',...(cancel?['failed']:[])].includes(t.status))){const e=this.port.read(t);if(e.status==='running'||cancel&&['approval','paused','failed'].includes(e.status)){try{await(cancel?this.port.cancel(t):this.port.pause(t));}catch{unconfirmed=true;t.error={kind:'disconnect',message:'Stop not confirmed; execution remains owned and blocks cancellation'};}}}
  const live=unconfirmed||w.tasks.some(t=>t.executionId&&(cancel?['starting','running','approval']:['starting','running']).includes(this.port.read(t).status));
  for(const t of w.tasks.filter(t=>t.executionId))t.checkpointId=this.port.read(t).checkpointId??t.checkpointId;
  if(!live){if(cancel){w.status='cancelled';w.completedAt=this.now();for(const a of w.team?.approvals??[])if(a.status==='pending'){a.status='rejected';a.resolvedAt=this.now();}for(const t of w.tasks)if(t.status!=='completed')t.status='cancelled';this.event(w,'workflow_cancelled',null,'Workflow cancelled; completed results retained');}else{w.status='paused';for(const t of w.tasks)if(['running','launching'].includes(t.status))t.status='paused';this.event(w,'workflow_paused',null,'Workflow checkpoint saved; dependent tasks blocked');}}
 }
 tick():Promise<void>{return this.serial(async()=>{
  for(const w of this.book.workflows.filter(w=>!['completed','cancelled'].includes(w.status))){
   if(w.status==='paused'){const eligible=w.tasks.filter(t=>t.status==='failed'&&t.resource?.retry.automatic&&t.resource.retryAt&&Date.parse(t.resource.retryAt)<=Date.now());if(eligible.length&&w.tasks.every(t=>t.status!=='failed'||eligible.includes(t))&&!w.team?.approvals.some(a=>a.status==='pending'))for(const t of eligible){try{await this.port.prepareRetry(t);t.status='ready';t.executionId=null;delete t.resource!.retryAt;delete t.resource;w.status='running';w.error=null;this.event(w,'task.retry',t,'Bounded verified transient retry; completed tasks retained');}catch{t.resource!.retry.automatic=false;this.event(w,'task.retry.exhausted',t,'Existing execution could not be reconciled; Director required');}this.save();}}
   await this.observe(w);this.routeBlockers(w);this.remediate(w);this.save();
   if(w.status==='running'&&w.team&&w.planned){try{this.port.validatePlan?.(w);}catch(error){w.status='pausing';w.error='Plan preflight blocked: '+(error as Error).message;this.event(w,'preflight_blocked',null,w.error);this.save();}}
   if(w.status==='running'&&!this.branchMatches(w)){w.status='pausing';w.error='Workflow branch changed; return explicitly to the recorded branch before continuing';this.event(w,'workflow_branch_mismatch',null,w.error);this.save();}
   if(w.status==='pausing'||w.status==='cancelling'){await this.stopActive(w,w.status==='cancelling');this.save();continue;}
   if(w.status!=='running')continue;
   if(w.tasks.every(t=>t.status==='completed'||!!w.team&&t.status==='cancelled')&&(!w.team||Object.values(w.team.gates).every(id=>gatePass(w.tasks.find(t=>t.id===id)!)))){if(w.team)w.team.final=finalResult(w);w.status='completed';w.error=null;w.completedAt=this.now();this.event(w,'workflow_completed',null,'All required results confirmed');this.save();continue;}
   const ready=w.tasks.filter(t=>['pending','ready'].includes(t.status)&&t.dependencies.every(d=>dependencySatisfied(w,t,d))&&(t.id==='plan'||w.planned));
   ready.sort((a,b)=>({high:0,normal:1,low:2}[a.priority]-{high:0,normal:1,low:2}[b.priority]));
   for(const t of ready){
    if(t.status==='pending'){t.status='ready';this.event(w,'dependency_satisfied',t,`${t.title}: all dependencies completed`);}
    const a=this.port.availability(),busy=Object.values(a).filter(x=>['starting','working','waiting','interrupting','pausing','resuming'].includes(x.execution)).length;
    if(busy>=this.port.maxActive)break;
    const owner=selectEmployee(t,a);if(!owner)continue;
    if(w.team&&t.teamSpec?.kind==='qa'&&!t.teamSpec.checksApproved){this.approval(w,t,'run_tests');this.save();continue;}
    t.inputContext=buildContext(w,t);if(w.team&&t.id!=='plan'){try{t.inputContext.inputs=buildTaskInputs(w,t);}catch(e){this.issue(w,t,'permanent','Attributed input context rejected: '+(e as Error).message);this.save();continue;}}if(t.id==='plan'&&w.planRecovery?.status==='revision_ready'){const previous=w.planRecovery.responses.at(-1)!;t.inputContext.planFeedback={executionId:previous.executionId,response:previous.text,issues:previous.issues};}if(this.project)t.inputContext.project={...structuredClone(this.project),activeTaskId:t.id,relevantSkills:[...t.requiredSkills]};if(w.team&&t.teamSpec){const rows=handoffs(w,t,t.inputContext);for(const h of rows)if(!w.team.handoffs.some(x=>x.id===h.id)){w.team.handoffs.push(h);this.event(w,'handoff_created',t,`${h.sourceEmployee} → ${h.targetEmployee}: ${h.sourceTaskId}`);}t.inputContext.team={spec:structuredClone(t.teamSpec),handoffs:rows};}
    try{const budget=lineageAttempts(w,t);if(budget.attempts>=budget.maxAttempts)throw Error('Shared continuation/retry budget exhausted; Director replanning required');this.port.preflight?.(t,t.inputContext);}catch(error){this.issue(w,t,'pause','Preflight blocked before model execution: '+(error as Error).message);this.save();continue;}
    t.executionId=`wf-${w.id}-${t.id}-${t.attempts+1}`;identifier(t.executionId);if(this.port.prepareResources&&this.port.resources){t.resource=this.port.prepareResources(t,t.inputContext);const admission=this.port.resources.allowed(t.executionId);if(!admission.allowed){this.port.resources.defer(t.executionId,admission.reason);this.save();continue;}}t.attempts++;t.status='launching';t.startedAt??=this.now();t.error=null;this.save();if(w.team){const k=t.teamSpec?.kind;this.event(w,k==='qa'?'qa_started':k==='review'?'review_started':k==='security'?'security_review_started':t.id==='plan'?'planning_started':'task_execution_requested',t,t.title);}
    try{await this.port.start(t,t.inputContext,t.executionId);const e=this.port.read(t);if(e.status==='running'){t.status='running';this.event(w,'task_started',t,`${t.title}: runtime started`);}}
    catch(error) {const e=error as Error&{code?:string};let observed;try{observed=this.port.read(t);}catch{}const knownFailure=observed?.status==='failed';this.issue(w,t,knownFailure?'recoverable':'disconnect',['TEAM_PROMPT_BUDGET','ORCHESTRATION_PROMPT_TOO_LARGE'].includes(e.code??'')?e.message:knownFailure?'Runtime confirmed a failed start; explicit bounded retry required.':'Runtime start outcome requires reconciliation; no duplicate start is permitted.');}
    this.save();if(w.status!=='running')break;
   }
   this.save();
  }
 });}
 command(workflowId:string,action:'pause'|'resume'|'cancel'|'retry'|'reject_approval'|'approve_action'|'reject_action'|'refresh_action'|'recheck_gate'|'revalidate_result'|'prepare_plan_repair'|'apply_plan_repair'|'revise_plan'|'defer_verification'|'retry_with_context'|'repair_proposal'|'reconcile_unsubmitted'|'reconcile_storage'|'restore_cancelled'|'prepare_operation_recovery'|'confirm_operation_recovery'|'cleanup_operation',taskId?:string):Promise<void>{return this.serial(async()=>{
  if(action==='reconcile_storage'){
   if(Object.values(this.port.availability()).some(a=>['starting','working','waiting','pausing','interrupting','resuming'].includes(a.execution)))throw new Error('Wait for active runtime before storage reconciliation');
   this.port.reconcileStorage?.();const fresh=validateWorkflowBook(this.storage.load(),this.port.source);if(fresh.workflows.some(w=>w.projectId!==(this.project?.projectId??'office-demo')||w.tasks.some(t=>t.inputContext?.project&&t.inputContext.project.workspaceRoot!==this.project?.workspaceRoot)))throw new Error('Foreign recovery snapshot');
   const target=fresh.workflows.find(w=>w.id===workflowId);if(!target)throw new Error('Selected workflow absent from valid stored snapshot');this.book=fresh;this.savedJSON=JSON.stringify(fresh);this.recoveryError=null;
   if(!['completed','cancelled'].includes(target.status)){target.status='paused';for(const task of target.tasks){if(task.resource){task.resource.retry.automatic=false;delete task.resource.retryAt;}if(['running','launching'].includes(task.status))task.status='paused';}await this.observe(target);target.status='paused';}
   this.event(target,'storage_reconciled',null,'Validated stored state and owned results reconciled; no new execution or effect; explicit resume required');this.save();return;
  }
  const w=this.get(workflowId);
  if(action==='restore_cancelled'){
   if(!this.branchMatches(w)||Object.values(this.port.availability()).some(a=>['starting','working','waiting','pausing','interrupting','resuming'].includes(a.execution)))throw new Error('Stop active work and return to recorded branch before restoration');const plan=cancellationRestorePlan(w);
   for(const id of plan.reconcileTaskIds)if(this.port.read(w.tasks.find(t=>t.id===id)!).status!=='completed')throw new Error('Previously started work requires confirmed execution reconciliation; no automatic restart');
   for(const id of plan.resultTaskIds){const task=w.tasks.find(t=>t.id===id)!;if(task.result?.team?.patches.length)this.port.preview?.(task);}
   for(const id of plan.taskIds){const task=w.tasks.find(t=>t.id===id)!;task.status='pending';task.completedAt=null;}w.status='paused';w.error=null;w.completedAt=null;for(const id of plan.resultTaskIds){const task=w.tasks.find(t=>t.id===id)!;task.status='completed';task.error=null;if(task.result?.team?.patches.length&&!w.team!.approvals.some(a=>a.taskId===id&&a.action==='apply_changes'&&a.status==='approved'))this.approval(w,task,'apply_changes');}for(const id of plan.reconcileTaskIds)w.tasks.find(t=>t.id===id)!.status='paused';if(plan.reconcileTaskIds.length)await this.observe(w);w.status='paused';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:'Explicit cancellation restoration; no execution or effect started'};this.event(w,'workflow_restored',null,'Selected cancellation restored on pause; owned results reconciled, fresh exact approvals prepared where needed, no execution or effect replay');this.save();return;
  }
  if(action==='resume'&&specificationBlockers(w).some(source=>w.tasks.some(t=>t.teamSpec?.kind==='resolution'&&t.teamSpec.remediationFor.includes(source.id)&&t.status==='completed'&&!specificationAddressed(w,source))))throw new Error('Lead blocker remains unresolved; Director decision or replanning required');if(['completed','cancelled'].includes(w.status))throw new Error('Workflow is closed');
  if(['resume','retry','reconcile_unsubmitted','approve_action','refresh_action','recheck_gate','revalidate_result','defer_verification','retry_with_context','repair_proposal'].includes(action)&&!this.branchMatches(w))throw new Error('Workflow branch changed; return explicitly to the original branch');
  const t=taskId?w.tasks.find(t=>t.id===taskId):undefined;if(taskId){identifier(taskId);if(!t&&!['approve_action','reject_action','refresh_action','prepare_operation_recovery','confirm_operation_recovery','cleanup_operation'].includes(action))throw new Error('Unknown workflow task');}
  if(['prepare_plan_repair','apply_plan_repair','revise_plan'].includes(action)){
   const root=w.tasks[0];if(!w.team||w.planned||w.tasks.length!==1||root.id!=='plan'||!this.branchMatches(w)||['completed','cancelled','cancelling'].includes(w.status))throw new Error('Plan recovery is unavailable');
   if(action==='prepare_plan_repair'){
    if(w.planRecovery)throw new Error('Plan recovery already prepared');
    if(root.status!=='failed'||!root.error?.message.startsWith('Result rejected:')||!root.executionId||!root.result?.summary)throw new Error('No preserved rejected planning response');
    w.planRecovery=await rejectedPlan(root.result.summary,w,root.executionId);root.status='completed';root.error=null;root.completedAt??=this.now();w.status='paused';w.error='План требует согласования: '+w.planRecovery.responses.at(-1)!.issues.map(i=>i.message).join('; ');this.event(w,'plan_recovery_prepared',root,w.error);
   }else if(action==='apply_plan_repair'){
    const r=w.planRecovery;if(r?.status!=='proposal_ready'||!r.candidate)throw new Error('No verified correction proposal');const candidate=suggestPlanRepair(r.responses.at(-1)!.text,w);if(JSON.stringify(candidate)!==JSON.stringify(r.candidate))throw new Error('Correction proposal changed');
    if(this.port.source==='codex'&&!this.port.validatePlanRepair)throw new Error('Project file preservation check unavailable');this.port.validatePlanRepair?.(w,r.candidate);this.installPlan(w,r.candidate.text);w.planRecovery={...r,status:'applied',acceptedText:r.candidate.text,resolution:'consolidated_tests'};w.status='paused';w.error=null;this.event(w,'plan_repair_applied',root,'Validated test-target consolidation; original response retained; explicit resume required');
   }else{
    const r=w.planRecovery;if(!r||!['needs_revision','proposal_ready'].includes(r.status)||root.attempts>=3||r.responses.length>=3||this.port.read(root).status!=='completed')throw new Error('Lead revision unavailable or limit reached');
    r.status='revision_ready';r.candidate=null;root.status='ready';root.executionId=null;root.result=null;root.error=null;root.completedAt=null;delete root.resource;w.status='paused';w.error=null;this.event(w,'plan_revision_prepared',root,'Only Lead revision queued; archived original response retained; explicit resume required');
   }
   this.save();return;
  }
  if(action==='prepare_operation_recovery'||action==='confirm_operation_recovery'||action==='cleanup_operation'){
   if(w.status!=='paused'||!this.branchMatches(w)||Object.values(this.port.availability()).some(a=>['starting','working','waiting','pausing','interrupting','resuming'].includes(a.execution)))throw new Error('Pause owned workflow and workers before operation recovery');const old=w.team?.approvals.find(a=>a.id===taskId&&a.status==='pending');if(!old)throw new Error('Pending exact action required');const target=w.tasks.find(t=>t.id===old.taskId)!;
   if(action==='prepare_operation_recovery'){
    if(!this.port.prepareOperationRecovery)throw new Error('Operation inspection unavailable');const plan=await this.port.prepareOperationRecovery(w,target,old);
    if(['completed','metadata_only'].includes(plan.state)){old.recoveryPreview={operationId:plan.operationId,planHash:plan.planHash,state:plan.state};this.event(w,'operation_recovery_prepared',target,'Observed completed postconditions; explicit metadata confirmation required, no effect replay');}
    else if(plan.state==='remaining_approval'){
     if(w.team!.approvals.length>=150)throw new Error('Approval history capacity reached');const next={...structuredClone(old),id:crypto.randomUUID(),status:'pending' as const,requestedAt:this.now(),resolvedAt:null,revision:null,recovery:{operationId:plan.operationId,planHash:plan.planHash,completedPaths:plan.completedPaths}};delete next.security;delete next.recoveryPreview;next.security=this.port.prepareApproval?.(w,target,next);old.status='rejected';old.resolvedAt=this.now();w.team!.approvals.push(next);this.event(w,'operation_recovery_prepared',target,'Fresh exact approval for remaining file effects; observed completed files will not be rewritten');
    }else if(plan.state==='cleanup_required'){old.recoveryPreview={operationId:plan.operationId,planHash:plan.planHash,state:plan.state};this.event(w,'qa_cleanup_prepared',target,'Owned container cleanup requires explicit confirmation; no test rerun');}
    else if(plan.state==='new_test_approval'){
     if(w.team!.approvals.length>=150)throw new Error('Approval history capacity reached');const next={...structuredClone(old),id:crypto.randomUUID(),status:'pending' as const,requestedAt:this.now(),resolvedAt:null,revision:null,supersedesOperationId:plan.operationId};delete next.security;delete next.operationId;delete next.recovery;delete next.recoveryPreview;next.security=this.port.prepareApproval?.(w,target,next);old.status='rejected';old.resolvedAt=this.now();w.team!.approvals.push(next);this.event(w,'qa_reapproval_prepared',target,'Previous QA confirmed stopped; a separate exact test approval is required; original unknown result preserved');
    }else throw new Error('Operation remains unknown or conflicting; no effect replay');
   }else if(action==='cleanup_operation'){if(!old.recoveryPreview||old.recoveryPreview.state!=='cleanup_required'||!this.port.cleanupOperation)throw new Error('Inspect the exact owned container before cleanup');await this.port.cleanupOperation(w,target,old);delete old.recoveryPreview;this.event(w,'qa_cleanup_confirmed',target,'Only the owned operation container was cleaned; no test rerun');}
   else{
    if(!this.port.confirmOperationRecovery||!old.recoveryPreview)throw new Error('Preview before metadata confirmation');const receipt=await this.port.confirmOperationRecovery(w,target,old);old.status='approved';old.resolvedAt=this.now();old.revision=receipt.revision;if(old.action==='apply_changes'){target.result!.filesChanged=receipt.filesChanged;target.status='completed';target.completedAt=this.now();}else{target.teamSpec!.checksApproved=true;target.teamSpec!.testEvidence=receipt.tests;target.status='ready';}target.error=null;this.event(w,'operation_reconciled',target,'Director confirmed observed receipt/postconditions; no file or command replay');
   }
   w.error=null;this.save();return;
  }
  if(action==='repair_proposal'){
   if(!t||w.status!=='paused'||t.status!=='failed'||!t.error?.message.startsWith('Result rejected: Patch limit')||!t.executionId||t.proposalRecovery||!this.port.repairProposal||Object.values(this.port.availability()).some(a=>['starting','working','waiting','pausing','interrupting','resuming'].includes(a.execution)))throw new Error('Only a preserved oversized proposal can be repaired on pause');
   const recovery=await this.port.repairProposal(t),result=collectTeamResult(recovery.correctedResponse,t),staged=structuredClone(w),target=staged.tasks.find(x=>x.id===t.id)!;target.result=result;target.proposalRecovery=recovery;validateWorkflowBook({...this.book,workflows:this.book.workflows.map(x=>x.id===w.id?staged:x)},this.port.source);
   const prior=structuredClone(t),priorError=w.error,approvalCount=w.team!.approvals.length;t.result=result;t.proposalRecovery=recovery;t.error=null;w.error=null;try{this.approval(w,t,'apply_changes');}catch(e){Object.assign(t,prior);if(!prior.proposalRecovery)delete t.proposalRecovery;w.error=priorError;w.team!.approvals.length=approvalCount;throw e;}this.event(w,'proposal_formatting_recovered',t,'Original response preserved; only TypeScript indentation reduced by '+recovery.removedCharacters+' characters; exact Director approval still required; no files applied or model turn started');this.save();return;
  }
  if(action==='retry_with_context'){
   if(!t||w.status!=='paused'||!contextRetryCandidate(w,t)||this.port.read(t).status!=='completed'||Object.values(this.port.availability()).some(a=>['starting','working','waiting','pausing','interrupting','resuming'].includes(a.execution)))throw new Error('Only a completed missing-input implementation can be prepared on pause');
   if(w.tasks.some(x=>/-context-[12]$/.test(x.id)&&x.teamSpec?.remediationFor.includes(t.id)))throw new Error('Context continuation already prepared');
   const dependents=w.tasks.filter(x=>x.dependencies.includes(t.id));if(!dependents.length||dependents.some(x=>x.executionId||!['pending','ready'].includes(x.status))||w.team!.approvals.some(a=>a.taskId===t.id&&a.status==='pending'))throw new Error('Started downstream work cannot be rewired');
   const count=w.tasks.filter(x=>/-context-[12]$/.test(x.id)).length,id=t.id+'-context-'+(count+1);if(count>=2||id.length>48||w.tasks.length>=80)throw new Error('Context recovery limit reached');
   const next=this.task({...t,id,title:('Continue: '+t.title).slice(0,160),description:('Continue the same implementation with fresh read-only dependency snapshots and attributed transitive design handoffs. The original BLOCKED response remains preserved. '+t.description).slice(0,1600),dependencies:[...new Set([...t.dependencies,t.id])],teamSpec:{...structuredClone(t.teamSpec!),remediationFor:[t.id],checksApproved:false,testEvidence:[]}} as PlanTask);
   buildTaskInputs(w,next);w.tasks.push(next);for(const d of dependents)d.dependencies=d.dependencies.map(id=>id===t.id?next.id:id);w.error=null;this.event(w,'context_continuation_prepared',t,'Only '+next.id+' prepared with the same write scope; original response preserved; explicit resume required');this.save();return;
  }
  if(action==='defer_verification'){
   if(!t||t.verificationDeferral||w.status!=='paused')throw new Error('Pause workflow before explicitly deferring verification');const c=deferredVerificationCandidate(w,t);
   if(!c||c.qa.executionId||!['pending','ready'].includes(c.qa.status)||Object.values(this.port.availability()).some(a=>['starting','working','waiting','pausing','interrupting','resuming'].includes(a.execution)))throw new Error('Only unperformed checks on an applied implementation can be deferred to unstarted QA');
   if(this.port.source==='codex'&&!this.port.validateVerificationDeferral)throw new Error('Applied file verification unavailable');this.port.validateVerificationDeferral?.(w,t);
   t.verificationDeferral={qaTaskId:c.qa.id,findingIds:c.findings.map(f=>f.id),executionId:t.executionId!,approvalId:c.approval.id,approvedAt:this.now()};w.error=null;this.event(w,'verification_deferred',t,'Director moved unperformed checks to '+c.qa.id+'; original BLOCKED preserved; QA evidence still mandatory; explicit resume required');this.save();return;
  }
  if(action==='refresh_action'){
   const old=w.team?.approvals.find(a=>a.id===taskId&&a.status==='pending');if(!old||!old.security||old.security.decision!=='denied'&&Date.parse(old.security.expiresAt)>Date.now())throw new Error('Only denied or expired pending approvals can be refreshed');
   if(w.team!.approvals.length>=150)throw new Error('Approval history limit reached');const target=w.tasks.find(t=>t.id===old.taskId)!;
   if(old.action==='apply_changes'&&(JSON.stringify(old.patches)!==JSON.stringify(target.result?.team?.patches)||JSON.stringify(old.previous)!==JSON.stringify(this.port.preview?.(target)??old.previous)))throw new Error('Original proposal changed; do not refresh stale approval');
   this.port.rejectAction?.(w,target,old);old.status='rejected';old.resolvedAt=this.now();
   try{this.approval(w,target,old.action);}catch(e){old.status='pending';old.resolvedAt=null;throw e;}
   this.event(w,'approval_refreshed',target,'Previous denied/expired approval retained; unchanged proposal requires a new exact Director confirmation');this.save();return;
  }
  if(action==='recheck_gate'){
   if(!t||!w.team||!['security','review','integration'].includes(t.teamSpec?.kind??'')||w.team.gates[t.teamSpec!.kind]!==t.id||t.status!=='completed'||t.result?.team?.verdict!=='BLOCKED'||t.result.team.findings.length)throw new Error('Only the current evidence-blocked gate without findings can be rechecked');
   const qa=w.tasks.find(t=>t.id===w.team!.gates.qa);if(!qa?.teamSpec?.testEvidence.length||qa.teamSpec.testEvidence.some(e=>e.status!=='PASS')||!(this.port.source==='mock'||this.port.canRecheckGate?.(w,t)))throw new Error('Fresh approved verification receipts required');
   const count=w.tasks.filter(t=>/-evidence-\d+$/.test(t.id)).length;if(count>=Math.min(3,w.team.maxCycles+1)||w.tasks.length>=80)throw new Error('Evidence recheck limit reached');
   const next=gateTask(t.id+'-evidence-'+(count+1),t.type,t.teamSpec!.kind,[...new Set([...t.dependencies,qa.id,t.id])],t.teamSpec!.scope,w.team.round);next.teamSpec.remediationFor=[t.id];next.description='Re-evaluate the original gate with fresh attributed verification receipts. Original BLOCKED result is preserved; do not request implementation or reapplication without concrete findings.';w.tasks.push(this.task(next));w.team.gates[t.teamSpec!.kind]=next.id;
   for(const other of w.tasks)if(other.id!==next.id&&['pending','ready'].includes(other.status)&&!other.executionId)other.dependencies=other.dependencies.map(id=>id===t.id?next.id:id);
   w.status='paused';w.error=null;this.event(w,'gate_evidence_recheck_prepared',t,'Fresh evidence recheck prepared; original result preserved; explicit resume required');this.save();return;
  }
  if(action==='reconcile_unsubmitted'){
   if(!t||w.status!=='paused'||!this.port.reconcileUnsubmitted||!t.executionId)throw Error('Unsubmitted recovery requires a paused owned task');
   const previous=t.executionId,proof=this.port.reconcileUnsubmitted(t);t.status='ready';t.executionId=null;t.checkpointId=null;t.error=null;delete t.resource;
   if(!w.tasks.some(x=>x.error))w.error=null;this.event(w,'unsubmitted_execution_reconciled',t,previous+': '+proof+'; explicit resume required');this.save();return;
  }
  if(action==='revalidate_result'){if(!t||!w.team||t.status!=='failed'||!t.error?.message.startsWith('Result rejected:')||this.port.read(t).status!=='completed')throw new Error('No rejected completed result to revalidate');const rejectedMessage=t.error?.message;t.status='running';t.error=null;this.event(w,'result_revalidation_requested',t,'Revalidate saved model result; no new Codex execution');await this.observe(w);if((t as WorkflowTask).status==='completed'&&w.error===rejectedMessage)w.error=null;this.save();return;}
  if(action==='approve_action'||action==='reject_action'){
   const resolved=w.team?.approvals.find(a=>a.id===taskId);if(action==='approve_action'&&resolved?.status==='approved')return;const approval=w.team?.approvals.find(a=>a.id===taskId&&a.status==='pending');if(!approval)throw new Error('Unknown or already resolved approval');const target=w.tasks.find(t=>t.id===approval.taskId)!;
   if(action==='reject_action'){this.port.rejectAction?.(w,target,approval);approval.status='rejected';approval.resolvedAt=this.now();target.status='failed';target.error={kind:'permanent',message:'Director rejected the exact proposed action'};w.status='paused';w.error=target.error.message;this.event(w,'approval_rejected',target,approval.reason);}
   else {if(!this.port.approve)throw new Error('Approval port unavailable');approval.operationId??=approval.recovery?.operationId??approval.id;this.save();const receipt=await this.port.approve(w,target,approval);approval.status='approved';approval.resolvedAt=this.now();approval.revision=receipt.revision;if(approval.action==='apply_changes'){target.result!.filesChanged=receipt.filesChanged;target.status='completed';target.completedAt=this.now();this.event(w,'task_completed',target,'Exact approved file changes applied; receipt saved');}else{target.teamSpec!.checksApproved=true;target.teamSpec!.testEvidence=receipt.tests;target.status='ready';}target.error=null;this.event(w,'approval_approved',target,'Director approved exact scoped action; receipt saved');}this.save();return;
  }
  if(action==='cancel'&&w.team?.approvals.some(a=>a.status==='pending'&&(a.operationId||a.recovery)))throw new Error('Reconcile started approval operations before cancellation; preserved effects cannot be abandoned');
  if(action==='pause'||action==='cancel'){for(const task of w.tasks)if(task.resource){delete task.resource.retryAt;task.resource.retry.automatic=false;}w.status=action==='cancel'?'cancelling':'pausing';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:action};this.event(w,'workflow_pause_requested',null,action);this.save();await this.stopActive(w,action==='cancel');}
  else if(action==='retry'){
   if(!t||t.status!=='failed'||t.error?.kind!=='recoverable'||lineageAttempts(w,t).attempts>=3)throw new Error('Retry is not safe or retry limit reached');
   const e=this.port.read(t);if(['starting','running','approval'].includes(e.status))throw new Error('Existing execution still active');
   if(e.status==='paused'){t.status='paused';}else{await this.port.prepareRetry(t);t.status='ready';t.executionId=null;delete t.resource;t.error=null;}if(!w.tasks.some(task=>task.status==='failed'||task.error))w.error=null;this.event(w,'task_retry_requested',t,'Director requested bounded retry; read-only only');
  }else if(action==='reject_approval'){
   if(!t||t.error?.kind!=='approval')throw new Error('No pending approval');await this.port.resolveApproval(t);t.error={kind:'pause',message:'Additional permission denied. Original read-only scope retained.'};this.event(w,'approval_rejected',t,t.error.message);
  }else if(action==='resume'){
   if(this.book.workflows.some(x=>x.id!==w.id&&['running','pausing','cancelling'].includes(x.status)))throw new Error('Pause the other workflow before resuming this one');
   await this.observe(w);
   if(w.planRecovery&&!w.planned&&w.planRecovery.status!=='revision_ready')throw new Error('Resolve plan diagnostics before resume');
   if(w.team?.approvals.some(a=>a.status==='pending')||w.tasks.some(t=>t.status==='failed'||t.error?.kind==='approval'))throw new Error('Resolve failures or reject additional permissions before resume');
   const paused=w.tasks.filter(t=>t.status==='paused');
   for(const t of paused){if(!t.executionId){if(t.attempts||t.startedAt)throw new Error('Started task has no execution identity; inspect recovery');t.status='pending';t.error=null;continue;}const e=this.port.read(t);if(e.status!=='paused'&&e.status!=='completed')throw new Error('Cannot resume missing or active execution; inspect runtime/checkpoint');}
   w.status='running';w.error=null;this.event(w,'workflow_resumed',null,'Director resumed workflow; completed tasks retained');
   // Resumes obey the same concurrency budget and run in later scheduler turns.
  }else throw new Error('Unknown workflow action');
  this.save();
 },action==='reconcile_storage');}
 resumeEligible():Promise<void>{return this.serial(async()=>{
  for(const w of this.book.workflows.filter(w=>w.status==='running'))for(const t of w.tasks.filter(t=>t.status==='paused'&&!!t.executionId&&t.error?.kind!=='approval'&&!w.team?.approvals.some(a=>a.taskId===t.id&&a.status==='pending'))){
   if(!this.branchMatches(w))continue;
   const a=this.port.availability(),owner=a[t.agentId];if(Object.values(a).filter(x=>['starting','working','waiting','interrupting','pausing','resuming'].includes(x.execution)).length>=this.port.maxActive)break;
   if(!owner?.connected||owner.recoveryError||owner.currentTask!==t.executionId||owner.execution!=='paused')continue;
   try{await this.port.resume(t);t.status='running';t.error=null;this.event(w,'task_resumed',t,'Existing task/checkpoint resumed; no new execution ID');}catch{this.issue(w,t,'disconnect','Checkpoint resume failed; preserved for Director');}this.save();
  }
 });}
}
