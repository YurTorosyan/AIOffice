import { Orchestrator } from './Orchestrator.ts';
import { BrowserWorkflowStorage, MockExecutionPort } from './MockExecutionPort.ts';
import type { MockScenario } from './MockExecutionPort.ts';
import type { MockCodexAdapter } from '../integration/MockCodexAdapter.ts';
import {emptyWorkflows} from './model.ts';
export type WorkflowSnapshot=ReturnType<Orchestrator['snapshot']>;
/** UI transport/controller only. The scheduler and both execution ports own the business rules. */
export class WorkflowClient {
 private engine:Orchestrator;private port:MockExecutionPort;private token:string|null=null;
 real:WorkflowSnapshot={...emptyWorkflows('codex'),recoveryError:null};
 constructor(adapter:MockCodexAdapter){this.adapter=adapter;this.port=new MockExecutionPort(adapter);this.engine=new Orchestrator(this.port,new BrowserWorkflowStorage());}
 private adapter:MockCodexAdapter;
 snapshot(mode:'mock'|'codex'){return mode==='mock'?this.engine.snapshot():structuredClone(this.real);}
 async refresh(mode:'mock'|'codex'){
  if(mode==='mock'){await this.engine.resumeEligible();await this.engine.tick();return;}
  const r=await fetch('/api/workflows/snapshot');if(!r.ok)throw new Error('Обновлённый мост оркестратора недоступен.');this.real=await r.json();
 }
 async command(mode:'mock'|'codex',action:'create'|'pause'|'resume'|'cancel'|'retry'|'reject_approval',workflowId:string,rootTask?:string,taskId?:string,scenario:MockScenario='parallel'){
  if(mode==='mock'){
   if(action==='create'){this.port.scenario=scenario;await this.adapter.action('connect_all');await this.engine.create(rootTask??'',workflowId);}else await this.engine.command(workflowId,action,taskId);
   await this.engine.resumeEligible();await this.engine.tick();return;
  }
  if(!this.token){const r=await fetch('/api/codex/session');if(!r.ok)throw new Error('Мост недоступен');this.token=(await r.json()).token;}
  const r=await fetch('/api/workflows/action',{method:'POST',headers:{'Content-Type':'application/json','X-AI-Office-Token':this.token!},body:JSON.stringify({action,workflowId,...(rootTask!==undefined?{rootTask}:{}),...(taskId?{taskId}:{})})});
  if(r.status===403)this.token=null;const body=await r.json();if(body.snapshot)this.real=body.snapshot;else if(r.ok)this.real=body;if(!r.ok)throw new Error(body.error??'Команда отклонена');
 }
 async advance(){const tasks=this.engine.snapshot().workflows.filter(w=>w.status==='running').flatMap(w=>w.tasks);await this.port.advance(tasks);await this.engine.tick();}
}
