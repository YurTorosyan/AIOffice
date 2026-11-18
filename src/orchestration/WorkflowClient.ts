import type {ProjectContext} from '../projects/model.ts';
import {emptyPermissions,rolePolicies} from '../security/policy.ts';
import type {PermissionBook} from '../security/policy.ts';
import { Orchestrator } from './Orchestrator.ts';
import { BrowserWorkflowStorage, MockExecutionPort,MemoryWorkflowStorage } from './MockExecutionPort.ts';
import type { MockScenario } from './MockExecutionPort.ts';
import type { MockCodexAdapter } from '../integration/MockCodexAdapter.ts';
import {emptyWorkflows} from './model.ts';
export type WorkflowSnapshot=ReturnType<Orchestrator['snapshot']>;
/** UI transport/controller only. The scheduler and both execution ports own the business rules. */
export class WorkflowClient {
 private engine:Orchestrator;private port:MockExecutionPort;private token:string|null=null;
 security:PermissionBook&{projectId?:string;available:boolean;error:string|null;executors?:{qaTests?:{available:boolean;reason:string|null;verifiedAt?:string;kind?:string}}}={...emptyPermissions(),available:false,error:null};
 readonly policies=rolePolicies;
 real:WorkflowSnapshot={projectId:'office-demo',...emptyWorkflows('codex'),recoveryError:null};
 constructor(adapter:MockCodexAdapter,context?:ProjectContext,persist=true){this.projectId=context?.projectId??'office-demo';this.real.projectId=this.projectId;this.adapter=adapter;this.port=new MockExecutionPort(adapter);this.engine=new Orchestrator(this.port,persist&&context?.runtimeMode!=='codex'?new BrowserWorkflowStorage(context?.projectId):new MemoryWorkflowStorage('mock'),context);}
 private projectId='office-demo';private suspended=false;private refreshController:AbortController|null=null;
 suspend(){this.suspended=true;this.refreshController?.abort();}
 activate(){this.suspended=false;}
 private adapter:MockCodexAdapter;
 updateProjectContext(context:ProjectContext){if(context.projectId!==this.projectId)throw new Error('Workflow context mismatch');this.engine.updateProjectContext(context);}
 async pauseForSwitch(){for(const w of this.engine.snapshot().workflows.filter(w=>w.status==='running'))await this.engine.command(w.id,'pause');}

 snapshot(mode:'mock'|'codex'){return mode==='mock'?this.engine.snapshot():structuredClone(this.real);}
 async refresh(mode:'mock'|'codex'){if(this.suspended)return;
  if(mode==='mock'){await this.engine.resumeEligible();await this.engine.tick();return;}
  this.refreshController=new AbortController();const signal=this.refreshController.signal;const r=await fetch('/api/workflows/snapshot?projectId='+encodeURIComponent(this.projectId),{signal});if(!r.ok)throw new Error('Обновлённый мост оркестратора недоступен.');const snapshot=await r.json();if((snapshot.projectId??'office-demo')!==this.projectId)throw new Error('Workflow project mismatch');this.real=snapshot;
  const security=await fetch('/api/security/snapshot?projectId='+encodeURIComponent(this.projectId),{signal});if(security.ok)this.security=await security.json();else this.security={...emptyPermissions(),available:false,error:'Мост ещё не загрузил Stage 7.'};
 }
 async command(mode:'mock'|'codex',action:'create'|'pause'|'resume'|'cancel'|'retry'|'reject_approval'|'approve_action'|'reject_action'|'refresh_action'|'recheck_gate'|'prepare_plan_repair'|'apply_plan_repair'|'revise_plan',workflowId:string,rootTask?:string,taskId?:string,scenario:MockScenario='parallel',team=false,maxCycles=2){
  if(mode==='mock'){
   if(action==='create'){this.port.scenario=scenario;await this.adapter.action('connect_all');await this.engine.create(rootTask??'',workflowId,{team,maxCycles});}else await this.engine.command(workflowId,action,taskId);
   await this.engine.resumeEligible();await this.engine.tick();return;
  }
  if(!this.token){const r=await fetch('/api/codex/session');if(!r.ok)throw new Error('Мост недоступен');this.token=(await r.json()).token;}
  const r=await fetch('/api/workflows/action',{method:'POST',headers:{'Content-Type':'application/json','X-AI-Office-Token':this.token!},body:JSON.stringify({projectId:this.projectId,action,workflowId,...(rootTask!==undefined?{rootTask}:{}),...(taskId?{taskId}:{}),...(action==='create'&&team?{team:true,maxCycles}:{})})});
  if(r.status===403)this.token=null;const body=await r.json();if(body.snapshot)this.real=body.snapshot;else if(r.ok)this.real=body;if(!r.ok)throw new Error(body.error??'Команда отклонена');
 }
 async advance(){const tasks=this.engine.snapshot().workflows.filter(w=>w.status==='running').flatMap(w=>w.tasks);await this.port.advance(tasks);await this.engine.tick();}
}
