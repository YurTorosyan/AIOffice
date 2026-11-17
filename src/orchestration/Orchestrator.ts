import type {ProjectContext} from '../projects/model.ts';
import {refinePendingImpacts,collectTeamResult,dependencySatisfied,deriveTeamPhase,finalResult,gatePass,handoffs,parseTeamPlan,roundGates,teamState,gateTask} from './team-workflow.ts';
import type {Approval,TeamSpec} from './team-workflow.ts';
import { buildContext, capabilities, clean, collectResult, emptyWorkflows, identifier, parsePlan, planningTask, selectEmployee, validatePlan, validateWorkflowBook } from './model.ts';
import type { ExecutionPort, PlanTask, Workflow, WorkflowBook, WorkflowStorage, WorkflowTask, Problem } from './model.ts';

/** Persist intentions BEFORE side effects. A single serialized scheduler owns all graph transitions. */
export class Orchestrator {
 private book:WorkflowBook; private tail:Promise<unknown>=Promise.resolve();private savedJSON='';
 recoveryError:string|null=null;
 constructor(privatePort:ExecutionPort,privateStorage:WorkflowStorage,project?:ProjectContext) {
  this.project=project;this.port=privatePort;this.storage=privateStorage;this.book=emptyWorkflows(this.port.source);
  try { this.book=validateWorkflowBook(this.storage.load(),this.port.source);
   if(this.book.workflows.some(w=>w.projectId!==(this.project?.projectId??'office-demo')||w.tasks.some(t=>t.inputContext?.project&&t.inputContext.project.workspaceRoot!==this.project?.workspaceRoot)))throw new Error('Workflow project/workspace mismatch');
   for(const w of this.book.workflows)if(!['completed','cancelled'].includes(w.status)){const refined=refinePendingImpacts(w);if(refined.length)this.event(w,'optional_gates_refined',null,`Removed unstarted optional gates: ${refined.join(', ')}`);w.status='paused';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:'Application restart; reconcile execution IDs before explicit resume'};for(const task of w.tasks)if(task.resource){delete task.resource.retryAt;task.resource.retry.automatic=false;}for(const t of w.tasks)if(['launching','running'].includes(t.status)){t.status='paused';t.error={kind:'disconnect',message:'Restart: existing execution will be reconciled, never blindly started again'};}}
   this.save();
  }catch {this.book=emptyWorkflows(this.port.source);this.recoveryError='Workflow storage invalid or unavailable. Original data preserved; execution blocked.';}
 }
 private project?:ProjectContext;
 private port:ExecutionPort; private storage:WorkflowStorage;
 private now(){return new Date().toISOString();}
 updateProjectContext(context:ProjectContext){if(context.projectId!==(this.project?.projectId??'office-demo')||this.project&&context.workspaceRoot!==this.project.workspaceRoot)throw new Error('Workflow project/workspace mismatch');this.project=context;}
 snapshot(){return {projectId:this.project?.projectId??'office-demo',...structuredClone(this.book),...(this.port.resources?{resources:{...this.port.resources.snapshot(),queuedTasks:this.book.workflows.filter(w=>w.status==='running').flatMap(w=>w.tasks).filter(t=>['pending','ready'].includes(t.status)).length}}:{}),recoveryError:this.recoveryError};}
 private save(){const prior=this.savedJSON?JSON.parse(this.savedJSON):null;for(const w of this.book.workflows)for(const t of w.tasks){const old=prior?.workflows.find((v:Workflow)=>v.id===w.id)?.tasks.find((v:WorkflowTask)=>v.id===t.id);if(!t.updatedAt)t.updatedAt=t.completedAt??t.startedAt??t.createdAt;else if(old&&JSON.stringify({...old,updatedAt:null})!==JSON.stringify({...t,updatedAt:null}))t.updatedAt=this.now();}for(const w of this.book.workflows){if(w.team)w.team.state=deriveTeamPhase(w);w.currentStage=w.team?.state??w.status;w.rootTaskId??='plan';}if(this.recoveryError)throw new Error(this.recoveryError);try{const json=JSON.stringify(this.book);if(json===this.savedJSON)return;this.storage.save(validateWorkflowBook(this.book,this.port.source));this.savedJSON=json;}catch{this.recoveryError='Workflow checkpoint could not be saved; execution blocked. Repair storage before continuing.';throw new Error(this.recoveryError);}}
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const p=this.tail.then(()=>{if(this.recoveryError)throw new Error(this.recoveryError);return fn();});this.tail=p.catch(()=>{});return p;}
 private event(w:Workflow,type:string,t:WorkflowTask|null,message:string){this.book.events.push({projectId:w.projectId,branch:this.project?.currentBranch??null,id:crypto.randomUUID(),type,workflowId:w.id,taskId:t?.id??null,agentId:t?.agentId??'lead',message,timestamp:this.now(),source:this.port.source});this.book.events=this.book.events.slice(-1000);}
 private task(p:PlanTask):WorkflowTask{const copy=structuredClone(p) as WorkflowTask;delete copy.resource;return {...copy,projectId:this.project?.projectId??'office-demo',branch:this.project?.currentBranch??null,agentId:capabilities[p.type].agentId,status:'pending',inputContext:null,result:null,error:null,executionId:null,attempts:0,checkpointId:null,createdAt:this.now(),startedAt:null,completedAt:null};}
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
  const parsed=w.team?parseTeamPlan(text,w):null,plan=parsed?.tasks??parsePlan(text);w.tasks.push(...plan.map(p=>this.task(p)));
  if(w.team&&parsed){w.team.impacts=parsed.impacts;w.tasks.push(...roundGates(w,plan.filter(p=>(p as any).teamSpec?.kind==='implementation').map(p=>p.id),0).map(p=>this.task(p)));}
  w.planned=true;this.event(w,'plan_generated',null,`Validated dependency graph: ${w.tasks.length-1} tasks`);for(const t of w.tasks.filter(t=>t.id!=='plan')){this.event(w,'employee_selected',t,`${t.agentId}: relevant role and Skills`);this.event(w,'task_assigned',t,`${t.title} → ${t.agentId}`);}
 }
 private approval(w:Workflow,t:WorkflowTask,action:Approval['action']){
  if(w.team!.approvals.some(a=>a.taskId===t.id&&a.status==='pending'))return;
  w.team!.approvals.push({id:crypto.randomUUID(),taskId:t.id,employeeId:t.agentId,action,reason:action==='apply_changes'?'Применить показанные изменения в текущем проекте после проверки diff':'Запустить показанные Node-тесты в текущем проекте. Сначала проверьте согласованный код.',status:'pending',requestedAt:this.now(),resolvedAt:null,patches:action==='apply_changes'?structuredClone(t.result!.team!.patches):[],previous:action==='apply_changes'?(this.port.preview?.(t)??Object.fromEntries(t.result!.team!.patches.map(p=>[p.path,null]))):{},commands:action==='run_tests'?[`node --experimental-strip-types --test ${t.teamSpec!.scope.filter(p=>p.startsWith('tests/')).join(' ')||'(no test files: BLOCKED)'}`]:[],revision:null});
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
 private async observe(w:Workflow){
  for(const t of w.tasks.filter(t=>t.executionId&&['launching','running','paused'].includes(t.status))){
   if(w.team?.approvals.some(a=>a.taskId===t.id&&a.status==='pending'))continue;
   const e=this.port.read(t);t.checkpointId=e.checkpointId??t.checkpointId;
   if(e.status==='completed'){
    try{if(w.team)this.port.validateResult?.(t);t.result=w.team&&t.id!=='plan'?collectTeamResult(e.result??'',t):collectResult(e.result??'');if(t.id==='plan'&&!w.planned)this.installPlan(w,e.result??'');t.status='completed';t.error=null;t.completedAt=this.now();if(w.team&&t.result.team?.patches.length){this.event(w,'proposal_created',t,`${t.title}: model proposal awaits Director approval`);this.approval(w,t,'apply_changes');}else this.event(w,'task_completed',t,`${t.title}: runtime confirmed completion`);}
    catch(error){this.issue(w,t,'permanent',`Result rejected: ${(error as Error).message}`);}
   }else if(e.status==='failed'&&t.status!=='failed'){this.issue(w,t,e.kind??'recoverable',clean(e.error??'Execution failed',1000));if(t.resource&&this.port.resources){t.resource.retry=this.port.resources.retry(t.executionId!,e.failureClass??'UNKNOWN',t.attempts);if(t.resource.retry.automatic)t.resource.retryAt=new Date(Date.now()+1000*Math.min(t.attempts,5)).toISOString();}}
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
   await this.observe(w);this.remediate(w);this.save();
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
    t.inputContext=buildContext(w,t);if(this.project)t.inputContext.project={...structuredClone(this.project),activeTaskId:t.id,relevantSkills:[...t.requiredSkills]};if(w.team&&t.teamSpec){const rows=handoffs(w,t,t.inputContext);for(const h of rows)if(!w.team.handoffs.some(x=>x.id===h.id)){w.team.handoffs.push(h);this.event(w,'handoff_created',t,`${h.sourceEmployee} → ${h.targetEmployee}: ${h.sourceTaskId}`);}t.inputContext.team={spec:structuredClone(t.teamSpec),handoffs:rows};}
    t.executionId=`wf-${w.id}-${t.id}-${t.attempts+1}`;identifier(t.executionId);if(this.port.prepareResources&&this.port.resources){t.resource=this.port.prepareResources(t,t.inputContext);const admission=this.port.resources.allowed(t.executionId);if(!admission.allowed){this.port.resources.defer(t.executionId,admission.reason);this.save();continue;}}t.attempts++;t.status='launching';t.startedAt??=this.now();t.error=null;this.save();if(w.team){const k=t.teamSpec?.kind;this.event(w,k==='qa'?'qa_started':k==='review'?'review_started':k==='security'?'security_review_started':t.id==='plan'?'planning_started':'task_execution_requested',t,t.title);}
    try{await this.port.start(t,t.inputContext,t.executionId);const e=this.port.read(t);if(e.status==='running'){t.status='running';this.event(w,'task_started',t,`${t.title}: runtime started`);}}
    catch {this.issue(w,t,'recoverable','Runtime start failed. Explicit bounded retry or checkpoint reconciliation required.');}
    this.save();if(w.status!=='running')break;
   }
   this.save();
  }
 });}
 command(workflowId:string,action:'pause'|'resume'|'cancel'|'retry'|'reject_approval'|'approve_action'|'reject_action'|'revalidate_result',taskId?:string):Promise<void>{return this.serial(async()=>{
  const w=this.get(workflowId);if(['completed','cancelled'].includes(w.status))throw new Error('Workflow is closed');
  if(['resume','retry','approve_action','revalidate_result'].includes(action)&&!this.branchMatches(w))throw new Error('Workflow branch changed; return explicitly to the original branch');
  const t=taskId?w.tasks.find(t=>t.id===taskId):undefined;if(taskId){identifier(taskId);if(!t&&!['approve_action','reject_action'].includes(action))throw new Error('Unknown workflow task');}
  if(action==='revalidate_result'){if(!t||!w.team||t.status!=='failed'||!t.error?.message.startsWith('Result rejected:')||this.port.read(t).status!=='completed')throw new Error('No rejected completed result to revalidate');t.status='running';t.error=null;this.event(w,'result_revalidation_requested',t,'Revalidate saved model result; no new Codex execution');await this.observe(w);this.save();return;}
  if(action==='approve_action'||action==='reject_action'){
   const approval=w.team?.approvals.find(a=>a.id===taskId&&a.status==='pending');if(!approval)throw new Error('Unknown or already resolved approval');const target=w.tasks.find(t=>t.id===approval.taskId)!;
   if(action==='reject_action'){this.port.rejectAction?.(w,target,approval);approval.status='rejected';approval.resolvedAt=this.now();target.status='failed';target.error={kind:'permanent',message:'Director rejected the exact proposed action'};w.status='paused';w.error=target.error.message;this.event(w,'approval_rejected',target,approval.reason);}
   else {if(!this.port.approve)throw new Error('Approval port unavailable');const receipt=await this.port.approve(w,target,approval);approval.status='approved';approval.resolvedAt=this.now();approval.revision=receipt.revision;if(approval.action==='apply_changes'){target.result!.filesChanged=receipt.filesChanged;target.status='completed';target.completedAt=this.now();this.event(w,'task_completed',target,'Exact approved file changes applied; receipt saved');}else{target.teamSpec!.checksApproved=true;target.teamSpec!.testEvidence=receipt.tests;target.status='ready';}target.error=null;this.event(w,'approval_approved',target,'Director approved exact scoped action; receipt saved');}this.save();return;
  }
  if(action==='pause'||action==='cancel'){for(const task of w.tasks)if(task.resource){delete task.resource.retryAt;task.resource.retry.automatic=false;}w.status=action==='cancel'?'cancelling':'pausing';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:action};this.event(w,'workflow_pause_requested',null,action);this.save();await this.stopActive(w,action==='cancel');}
  else if(action==='retry'){
   if(!t||t.status!=='failed'||t.error?.kind!=='recoverable'||t.attempts>=3)throw new Error('Retry is not safe or retry limit reached');
   const e=this.port.read(t);if(['starting','running','approval'].includes(e.status))throw new Error('Existing execution still active');
   if(e.status==='paused'){t.status='paused';}else{await this.port.prepareRetry(t);t.status='ready';t.executionId=null;delete t.resource;t.error=null;}this.event(w,'task_retry_requested',t,'Director requested bounded retry; read-only only');
  }else if(action==='reject_approval'){
   if(!t||t.error?.kind!=='approval')throw new Error('No pending approval');await this.port.resolveApproval(t);t.error={kind:'pause',message:'Additional permission denied. Original read-only scope retained.'};this.event(w,'approval_rejected',t,t.error.message);
  }else if(action==='resume'){
   await this.observe(w);
   if(w.team?.approvals.some(a=>a.status==='pending')||w.tasks.some(t=>t.status==='failed'||t.error?.kind==='approval'))throw new Error('Resolve failures or reject additional permissions before resume');
   const paused=w.tasks.filter(t=>t.status==='paused');
   for(const t of paused){const e=this.port.read(t);if(e.status!=='paused'&&e.status!=='completed')throw new Error('Cannot resume missing or active execution; inspect runtime/checkpoint');}
   w.status='running';w.error=null;this.event(w,'workflow_resumed',null,'Director resumed workflow; completed tasks retained');
   // Resumes obey the same concurrency budget and run in later scheduler turns.
  }else throw new Error('Unknown workflow action');
  this.save();
 });}
 resumeEligible():Promise<void>{return this.serial(async()=>{
  for(const w of this.book.workflows.filter(w=>w.status==='running'))for(const t of w.tasks.filter(t=>t.status==='paused'&&!!t.executionId&&t.error?.kind!=='approval'&&!w.team?.approvals.some(a=>a.taskId===t.id&&a.status==='pending'))){
   if(!this.branchMatches(w))continue;
   const a=this.port.availability(),owner=a[t.agentId];if(Object.values(a).filter(x=>['starting','working','waiting','interrupting','pausing','resuming'].includes(x.execution)).length>=this.port.maxActive)break;
   if(!owner?.connected||owner.recoveryError||owner.currentTask!==t.executionId||owner.execution!=='paused')continue;
   try{await this.port.resume(t);t.status='running';t.error=null;this.event(w,'task_resumed',t,'Existing task/checkpoint resumed; no new execution ID');}catch{this.issue(w,t,'disconnect','Checkpoint resume failed; preserved for Director');}this.save();
  }
 });}
}
