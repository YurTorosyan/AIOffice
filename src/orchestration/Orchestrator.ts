import { buildContext, capabilities, clean, collectResult, emptyWorkflows, identifier, parsePlan, planningTask, selectEmployee, validatePlan, validateWorkflowBook } from './model.ts';
import type { ExecutionPort, PlanTask, Workflow, WorkflowBook, WorkflowStorage, WorkflowTask, Problem } from './model.ts';

/** Persist intentions BEFORE side effects. A single serialized scheduler owns all graph transitions. */
export class Orchestrator {
 private book:WorkflowBook; private tail:Promise<unknown>=Promise.resolve();private savedJSON='';
 recoveryError:string|null=null;
 constructor(privatePort:ExecutionPort,privateStorage:WorkflowStorage) {
  this.port=privatePort;this.storage=privateStorage;this.book=emptyWorkflows(this.port.source);
  try { this.book=validateWorkflowBook(this.storage.load(),this.port.source);
   for(const w of this.book.workflows)if(!['completed','cancelled'].includes(w.status)){w.status='paused';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:'Application restart; reconcile execution IDs before explicit resume'};for(const t of w.tasks)if(['launching','running'].includes(t.status)){t.status='paused';t.error={kind:'disconnect',message:'Restart: existing execution will be reconciled, never blindly started again'};}}
   this.save();
  }catch {this.recoveryError='Workflow storage invalid or unavailable. Original data preserved; execution blocked.';}
 }
 private port:ExecutionPort; private storage:WorkflowStorage;
 private now(){return new Date().toISOString();}
 snapshot(){return {...structuredClone(this.book),recoveryError:this.recoveryError};}
 private save(){if(this.recoveryError)throw new Error(this.recoveryError);try{const json=JSON.stringify(this.book);if(json===this.savedJSON)return;this.storage.save(validateWorkflowBook(this.book,this.port.source));this.savedJSON=json;}catch{this.recoveryError='Workflow checkpoint could not be saved; execution blocked. Repair storage before continuing.';throw new Error(this.recoveryError);}}
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const p=this.tail.then(()=>{if(this.recoveryError)throw new Error(this.recoveryError);return fn();});this.tail=p.catch(()=>{});return p;}
 private event(w:Workflow,type:string,t:WorkflowTask|null,message:string){this.book.events.push({id:crypto.randomUUID(),type,workflowId:w.id,taskId:t?.id??null,agentId:t?.agentId??'lead',message,timestamp:this.now(),source:this.port.source});this.book.events=this.book.events.slice(-1000);}
 private task(p:PlanTask):WorkflowTask{return {...structuredClone(p),agentId:capabilities[p.type].agentId,status:'pending',inputContext:null,result:null,error:null,executionId:null,attempts:0,checkpointId:null,createdAt:this.now(),startedAt:null,completedAt:null};}
 create(rootTask:string,requestId:string):Promise<string>{return this.serial(async()=>{
  identifier(requestId);if(requestId.length>48)throw new Error('Workflow ID too long');const root=clean(rootTask),existing=this.book.workflows.find(w=>w.id===requestId);
  if(existing){if(existing.rootTask!==root)throw new Error('Request ID reused with different task');return existing.id;}
  if(this.book.workflows.length>=30)throw new Error('Workflow history capacity reached');
  if(this.book.workflows.some(w=>!['cancelled','completed'].includes(w.status)))throw new Error('Finish or cancel the current workflow first');
  const w:Workflow={id:requestId,projectId:'office-demo',source:this.port.source,rootTask:root,status:'running',priority:'normal',tasks:[this.task(planningTask)],planned:false,error:null,createdAt:this.now(),startedAt:this.now(),completedAt:null,checkpoint:null};
  this.book.workflows.push(w);this.event(w,'workflow_created',null,'Director started a read-only team workflow');this.save();return w.id;
 });}
 private get(id:string){identifier(id);const w=this.book.workflows.find(w=>w.id===id);if(!w)throw new Error('Unknown workflow');return w;}
 private issue(w:Workflow,t:WorkflowTask,kind:Problem,message:string){t.error={kind,message};t.status=kind==='permanent'||kind==='recoverable'?'failed':'paused';this.event(w,kind==='approval'?'approval_requested':t.status==='failed'?'task_failed':'task_paused',t,message);w.error=message;w.status='pausing';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:kind};}
 private installPlan(w:Workflow,text:string){const plan=parsePlan(text);w.tasks.push(...plan.map(p=>this.task(p)));w.planned=true;this.event(w,'plan_generated',null,`Validated dependency graph: ${plan.length} tasks`);for(const t of w.tasks.filter(t=>t.id!=='plan'))this.event(w,'task_assigned',t,`${t.title} → ${t.agentId}, matching role and Skills`);}
 private async observe(w:Workflow){
  for(const t of w.tasks.filter(t=>t.executionId&&['launching','running','paused'].includes(t.status))){
   const e=this.port.read(t);t.checkpointId=e.checkpointId??t.checkpointId;
   if(e.status==='completed'){
    try{t.result=collectResult(e.result??'');if(t.id==='plan'&&!w.planned)this.installPlan(w,e.result??'');t.status='completed';t.error=null;t.completedAt=this.now();this.event(w,'task_completed',t,`${t.title}: runtime confirmed completion`);}
    catch(error){this.issue(w,t,'permanent',`Result rejected: ${(error as Error).message}`);}
   }else if(e.status==='failed'&&t.status!=='failed')this.issue(w,t,e.kind??'recoverable',clean(e.error??'Execution failed',1000));
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
  if(!live){if(cancel){w.status='cancelled';w.completedAt=this.now();for(const t of w.tasks)if(t.status!=='completed')t.status='cancelled';this.event(w,'workflow_cancelled',null,'Workflow cancelled; completed results retained');}else{w.status='paused';for(const t of w.tasks)if(['running','launching'].includes(t.status))t.status='paused';this.event(w,'workflow_paused',null,'Workflow checkpoint saved; dependent tasks blocked');}}
 }
 tick():Promise<void>{return this.serial(async()=>{
  for(const w of this.book.workflows.filter(w=>!['completed','cancelled'].includes(w.status))){
   await this.observe(w);this.save();
   if(w.status==='pausing'||w.status==='cancelling'){await this.stopActive(w,w.status==='cancelling');this.save();continue;}
   if(w.status!=='running')continue;
   if(w.tasks.every(t=>t.status==='completed')){w.status='completed';w.error=null;w.completedAt=this.now();this.event(w,'workflow_completed',null,'All required results confirmed');this.save();continue;}
   const ready=w.tasks.filter(t=>['pending','ready'].includes(t.status)&&t.dependencies.every(d=>w.tasks.find(x=>x.id===d)?.status==='completed')&&(t.id==='plan'||w.planned));
   ready.sort((a,b)=>({high:0,normal:1,low:2}[a.priority]-{high:0,normal:1,low:2}[b.priority]));
   for(const t of ready){
    if(t.status==='pending'){t.status='ready';this.event(w,'dependency_satisfied',t,`${t.title}: all dependencies completed`);}
    const a=this.port.availability(),busy=Object.values(a).filter(x=>['starting','working','waiting','interrupting','pausing','resuming'].includes(x.execution)).length;
    if(busy>=this.port.maxActive)break;
    const owner=selectEmployee(t,a);if(!owner)continue;
    t.inputContext=buildContext(w,t);t.executionId=`wf-${w.id}-${t.id}-${t.attempts+1}`;identifier(t.executionId);t.attempts++;t.status='launching';t.startedAt??=this.now();t.error=null;this.save();
    try{await this.port.start(t,t.inputContext,t.executionId);const e=this.port.read(t);if(e.status==='running'){t.status='running';this.event(w,'task_started',t,`${t.title}: runtime started`);}}
    catch {this.issue(w,t,'recoverable','Runtime start failed. Explicit bounded retry or checkpoint reconciliation required.');}
    this.save();if(w.status!=='running')break;
   }
   this.save();
  }
 });}
 command(workflowId:string,action:'pause'|'resume'|'cancel'|'retry'|'reject_approval',taskId?:string):Promise<void>{return this.serial(async()=>{
  const w=this.get(workflowId);if(['completed','cancelled'].includes(w.status))throw new Error('Workflow is closed');
  const t=taskId?w.tasks.find(t=>t.id===taskId):undefined;if(taskId){identifier(taskId);if(!t)throw new Error('Unknown workflow task');}
  if(action==='pause'||action==='cancel'){w.status=action==='cancel'?'cancelling':'pausing';w.checkpoint={id:crypto.randomUUID(),createdAt:this.now(),reason:action};this.event(w,'workflow_pause_requested',null,action);this.save();await this.stopActive(w,action==='cancel');}
  else if(action==='retry'){
   if(!t||t.status!=='failed'||t.error?.kind!=='recoverable'||t.attempts>=3)throw new Error('Retry is not safe or retry limit reached');
   const e=this.port.read(t);if(['starting','running','approval'].includes(e.status))throw new Error('Existing execution still active');
   if(e.status==='paused'){t.status='paused';}else{await this.port.prepareRetry(t);t.status='ready';t.executionId=null;t.error=null;}this.event(w,'task_retry_requested',t,'Director requested bounded retry; read-only only');
  }else if(action==='reject_approval'){
   if(!t||t.error?.kind!=='approval')throw new Error('No pending approval');await this.port.resolveApproval(t);t.error={kind:'pause',message:'Additional permission denied. Original read-only scope retained.'};this.event(w,'approval_rejected',t,t.error.message);
  }else if(action==='resume'){
   await this.observe(w);
   if(w.tasks.some(t=>t.status==='failed'||t.error?.kind==='approval'))throw new Error('Resolve failures or reject additional permissions before resume');
   const paused=w.tasks.filter(t=>t.status==='paused');
   for(const t of paused){const e=this.port.read(t);if(e.status!=='paused'&&e.status!=='completed')throw new Error('Cannot resume missing or active execution; inspect runtime/checkpoint');}
   w.status='running';w.error=null;this.event(w,'workflow_resumed',null,'Director resumed workflow; completed tasks retained');
   // Resumes obey the same concurrency budget and run in later scheduler turns.
  }else throw new Error('Unknown workflow action');
  this.save();
 });}
 resumeEligible():Promise<void>{return this.serial(async()=>{
  for(const w of this.book.workflows.filter(w=>w.status==='running'))for(const t of w.tasks.filter(t=>t.status==='paused'&&t.error?.kind!=='approval')){
   const a=this.port.availability(),owner=a[t.agentId];if(Object.values(a).filter(x=>['starting','working','waiting','interrupting','pausing','resuming'].includes(x.execution)).length>=this.port.maxActive)break;
   if(!owner?.connected||owner.recoveryError||owner.currentTask!==t.executionId||owner.execution!=='paused')continue;
   try{await this.port.resume(t);t.status='running';t.error=null;this.event(w,'task_resumed',t,'Existing task/checkpoint resumed; no new execution ID');}catch{this.issue(w,t,'disconnect','Checkpoint resume failed; preserved for Director');}this.save();
  }
 });}
}
