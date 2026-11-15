import { capabilities, emptyWorkflows, validateWorkflowBook } from './model.ts';
import type { Context, Execution, ExecutionPort, PlanTask, WorkflowBook, WorkflowStorage, WorkflowTask } from './model.ts';
import type { MockCodexAdapter } from '../integration/MockCodexAdapter.ts';
export type MockScenario='sequential'|'parallel'|'failure'|'pause'|'approval'|'limit';
/** Deterministic fixtures only. Production planning always comes from the real Lead. */
export function mockPlan(scenario:MockScenario):{tasks:PlanTask[]} {
 const task=(id:string,type:PlanTask['type'],dependencies:string[]=[]):PlanTask=>({id,title:`Mock · ${type}`,description:`Read-only ${type} analysis fixture`,type,dependencies,requiredSkills:[capabilities[type].skill],priority:'normal',permissions:['read-only']});
 return {tasks:scenario==='parallel'?[task('design','design'),task('api','backend'),task('ui','frontend',['design','api']),task('checks','testing',['ui']),task('review','review',['checks']),task('summary','planning',['review'])]:[task('api','backend'),task('checks','testing',['api']),task('summary','planning',['checks'])]};
}
export class MockExecutionPort implements ExecutionPort {
 readonly source='mock';readonly maxActive=2;
 scenario:MockScenario='parallel';private held=new Map<string,Execution>();
 constructor(adapter:MockCodexAdapter){this.adapter=adapter;}
 private adapter:MockCodexAdapter;
 availability(){const r=this.adapter.getRuntime();return Object.fromEntries(Object.entries(r.members??{}).map(([id,s])=>[id,{connected:s.connection==='connected',execution:s.execution,currentTask:s.taskId??null,skills:s.skills,recoveryError:s.recoveryError}]));}
 async start(t:WorkflowTask,context:Context,id:string){this.adapter.startOrchestrated(t.agentId,id,t.title,`${context.rootTask}\n${t.description}`);}
 read(t:WorkflowTask):Execution {
  const task=this.adapter.getTasks().find(x=>x.id===t.executionId),held=this.held.get(t.executionId!);
  if(!task)return {id:t.executionId!,status:'missing'};
  const cp=this.adapter.getCheckpoints().filter(c=>c.taskId===task.id).at(-1);
  return held??{id:task.id,status:task.status==='completed'?'completed':task.status==='failed'?'failed':task.status==='paused'?'paused':'running',kind:task.pauseReason==='limit_reached'?'usage_limit':task.status==='failed'?'recoverable':'pause',checkpointId:cp?.id,result:t.id==='plan'?JSON.stringify(mockPlan(this.scenario)):`Mock result: ${t.title}. Dependencies: ${t.dependencies.join(', ')||'none'}. No real Codex execution.`};
 }
 async pause(t:WorkflowTask){if(this.held.has(t.executionId!))this.held.delete(t.executionId!);await this.adapter.action('pause',{agentId:t.agentId,taskId:t.executionId!});}
 async resume(t:WorkflowTask){await this.adapter.action('resume',{agentId:t.agentId,taskId:t.executionId!});}
 async cancel(t:WorkflowTask){if(this.read(t).status==='running'||this.read(t).status==='approval')await this.pause(t);if(this.read(t).status==='paused'){await this.resume(t);this.adapter.dispatch({type:'transition',taskId:t.executionId!,status:'failed'});}if(this.read(t).status==='failed')await this.prepareRetry(t);}
 async resolveApproval(t:WorkflowTask){this.held.delete(t.executionId!);if(this.read(t).status==='running')await this.pause(t);}
 async prepareRetry(t:WorkflowTask){if(this.read(t).status!=='failed')throw new Error('Failure not confirmed');this.adapter.dispatch({type:'agent_status',agentId:t.agentId,status:'idle'});}
 async advance(tasks:WorkflowTask[]){
  for(const t of tasks.filter(t=>['running','launching'].includes(t.status))){if(this.read(t).status!=='running')continue;
   if(t.id==='api'&&t.attempts===1&&['failure','pause','approval','limit'].includes(this.scenario)){
    // Scenario is saved by the controller. Subsequent explicit continuation must make progress.
    const scenario=this.scenario;this.scenario='sequential';
    if(scenario==='approval'){this.held.set(t.executionId!,{id:t.executionId!,status:'approval',kind:'approval'});continue;}
    await this.adapter.action(scenario==='failure'?'mock_error':scenario==='limit'?'mock_limit':'pause',{agentId:t.agentId,taskId:t.executionId!});continue;
   }
   this.adapter.dispatch({type:'transition',taskId:t.executionId!,status:'completed'});
  }
 }
}
export class MemoryWorkflowStorage implements WorkflowStorage {
 book:WorkflowBook;constructor(source:'mock'|'codex'='mock'){this.book=emptyWorkflows(source);}load(){return structuredClone(this.book);}save(book:WorkflowBook){this.book=validateWorkflowBook(book,this.book.source);}
}
export class BrowserWorkflowStorage implements WorkflowStorage {
 load(){const raw=localStorage.getItem('ai-office-orchestrator-v1');return raw?validateWorkflowBook(JSON.parse(raw),'mock'):emptyWorkflows('mock');}
 save(book:WorkflowBook){localStorage.setItem('ai-office-orchestrator-v1',JSON.stringify(validateWorkflowBook(book,'mock')));}
}
