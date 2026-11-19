import type {ProjectContext} from '../projects/model.ts';
import {emptyPermissions,rolePolicies} from '../security/policy.ts';
import type {PermissionBook} from '../security/policy.ts';
import { Orchestrator } from './Orchestrator.ts';
import { BrowserWorkflowStorage, MockExecutionPort,MemoryWorkflowStorage } from './MockExecutionPort.ts';
import type { MockScenario } from './MockExecutionPort.ts';
import type { MockCodexAdapter } from '../integration/MockCodexAdapter.ts';
import {emptyWorkflows,validateWorkflowBook} from './model.ts';
import {workflowDiagnostics} from './diagnostics.ts';
export type WorkflowSnapshot=ReturnType<Orchestrator['snapshot']>&{transport?:{lastReceivedAt:string|null;error:string|null;unknownCommand:string|null}};
/** UI transport/controller only. The scheduler and both execution ports own the business rules. */
export class WorkflowClient {
 private engine:Orchestrator;private port:MockExecutionPort;private token:string|null=null;
 security:PermissionBook&{projectId?:string;available:boolean;error:string|null;executors?:{qaTests?:{available:boolean;reason:string|null;verifiedAt?:string;kind?:string}}}={...emptyPermissions(),available:false,error:null};
 readonly policies=rolePolicies;
 real:WorkflowSnapshot={projectId:'office-demo',...emptyWorkflows('codex'),recoveryError:null,lastSavedAt:null,diagnostics:[]};
 constructor(adapter:MockCodexAdapter,context?:ProjectContext,persist=true){this.projectId=context?.projectId??'office-demo';this.real.projectId=this.projectId;this.adapter=adapter;this.port=new MockExecutionPort(adapter);this.engine=new Orchestrator(this.port,persist&&context?.runtimeMode!=='codex'?new BrowserWorkflowStorage(context?.projectId):new MemoryWorkflowStorage('mock'),context);}
 private lastReceivedAt:string|null=null;private transportError:string|null=null;private unknownCommand:string|null=null;private pendingRequest:{key:string;id:string}|null=null;
 private checkedSnapshot(value:WorkflowSnapshot){if((value?.projectId??'office-demo')!==this.projectId)throw new Error('Workflow project mismatch');const book=validateWorkflowBook(value,'codex');return {...value,...book,diagnostics:book.workflows.map(workflowDiagnostics),lastSavedAt:value.lastSavedAt??null};}
 private projectId='office-demo';private suspended=false;private refreshController:AbortController|null=null;
 suspend(){this.suspended=true;this.refreshController?.abort();}
 activate(){this.suspended=false;}
 private adapter:MockCodexAdapter;
 updateProjectContext(context:ProjectContext){if(context.projectId!==this.projectId)throw new Error('Workflow context mismatch');this.engine.updateProjectContext(context);}
 async pauseForSwitch(){for(const w of this.engine.snapshot().workflows.filter(w=>w.status==='running'))await this.engine.command(w.id,'pause');}

 snapshot(mode:'mock'|'codex'){return mode==='mock'?this.engine.snapshot():structuredClone({...this.real,transport:{lastReceivedAt:this.lastReceivedAt,error:this.transportError,unknownCommand:this.unknownCommand}});}
 async refresh(mode:'mock'|'codex'){if(this.suspended)return;
  if(mode==='mock'){await this.engine.resumeEligible();await this.engine.tick();return;}
  try{this.refreshController=new AbortController();const signal=this.refreshController.signal;const r=await fetch('/api/workflows/snapshot?projectId='+encodeURIComponent(this.projectId),{signal});if(!r.ok)throw new Error('Обновлённый мост оркестратора недоступен.');const snapshot=this.checkedSnapshot(await r.json());this.real=snapshot;this.lastReceivedAt=new Date().toISOString();this.transportError=null;
  const security=await fetch('/api/security/snapshot?projectId='+encodeURIComponent(this.projectId),{signal});if(security.ok){const value=await security.json();if((value.projectId??'office-demo')!==this.projectId)throw Error('Foreign security snapshot');this.security=value;}else this.security={...emptyPermissions(),available:false,error:'Мост ещё не загрузил Stage 7.'};}catch(e){if(!this.suspended)this.transportError='Мост недоступен; показано последнее полученное состояние';throw e;}
 }
 async command(mode:'mock'|'codex',action:'create'|'pause'|'resume'|'cancel'|'retry'|'reject_approval'|'approve_action'|'reject_action'|'refresh_action'|'recheck_gate'|'prepare_plan_repair'|'apply_plan_repair'|'revise_plan'|'defer_verification'|'retry_with_context'|'repair_proposal'|'reconcile_storage'|'restore_cancelled'|'prepare_operation_recovery'|'confirm_operation_recovery'|'cleanup_operation',workflowId:string,rootTask?:string,taskId?:string,scenario:MockScenario='parallel',team=false,maxCycles=2){
  if(mode==='mock'){
   if(action==='create'){this.port.scenario=scenario;await this.adapter.action('connect_all');await this.engine.create(rootTask??'',workflowId,{team,maxCycles});}else await this.engine.command(workflowId,action,taskId);
   await this.engine.resumeEligible();await this.engine.tick();return;
  }
  if(!this.token){const r=await fetch('/api/codex/session');if(!r.ok)throw new Error('Мост недоступен');this.token=(await r.json()).token;}
  const key=JSON.stringify([action,workflowId,rootTask,taskId,team,maxCycles]);if(this.pendingRequest&&this.pendingRequest.key!==key){if(!['pause','cancel','reconcile_storage','prepare_operation_recovery','confirm_operation_recovery','cleanup_operation','reject_action','reject_approval'].includes(action))throw new Error('Сначала сверяйте исход предыдущей команды; новая команда не отправлена');this.pendingRequest=null;}this.pendingRequest??={key,id:crypto.randomUUID()};let r:Response;try{r=await fetch('/api/workflows/action',{method:'POST',headers:{'Content-Type':'application/json','X-AI-Office-Token':this.token!,'X-AI-Office-Request-Id':this.pendingRequest.id},body:JSON.stringify({projectId:this.projectId,action,workflowId,...(rootTask!==undefined?{rootTask}:{}),...(taskId?{taskId}:{}),...(action==='create'&&team?{team:true,maxCycles}:{})})});}catch{this.unknownCommand=action+' · '+workflowId+' · '+(taskId??'workflow');try{await this.refresh('codex');}catch{}throw new Error('Ответ команды потерян. Выполнена только сверка состояния; действие не повторялось.');}
  if(r.status===403)this.token=null;let body;try{body=await r.json();}catch{this.unknownCommand=action+' · '+workflowId;try{await this.refresh('codex');}catch{}throw new Error('Ответ команды неполон; требуется сверка без повторения эффекта');}if((body.snapshot??(r.ok?body:null))&&((body.snapshot??body).projectId??'office-demo')!==this.projectId){this.transportError='Ответ другого проекта отклонён';this.unknownCommand=action+' · '+workflowId;throw new Error(this.transportError);}let received:WorkflowSnapshot|undefined;try{if(body.snapshot||r.ok)received=this.checkedSnapshot(body.snapshot??body);}catch{this.unknownCommand=action+' · '+workflowId;try{await this.refresh('codex');}catch{}throw new Error('Ответ команды не соответствует контракту; выполнена только сверка состояния');}this.pendingRequest=null;this.unknownCommand=null;this.transportError=null;if(received){this.real=received;this.lastReceivedAt=new Date().toISOString();}if(!r.ok)throw new Error(body.error??'Команда отклонена');
 }
 async advance(){const tasks=this.engine.snapshot().workflows.filter(w=>w.status==='running').flatMap(w=>w.tasks);await this.port.advance(tasks);await this.engine.tick();}
}
