import type {Approval,TeamOutcome} from './team-workflow.ts';
import type {Workflow} from './model.ts';
import { capabilities, emptyWorkflows, validateWorkflowBook } from './model.ts';
import type { Context, Execution, ExecutionPort, PlanTask, WorkflowBook, WorkflowStorage, WorkflowTask } from './model.ts';
import type { MockCodexAdapter } from '../integration/MockCodexAdapter.ts';
export type MockScenario='sequential'|'parallel'|'failure'|'pause'|'approval'|'limit'|'team-basic'|'team-parallel'|'team-qa-fail'|'team-security-block'|'team-review-reject';
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
 async start(t:WorkflowTask,context:Context,id:string){if((t.projectId??'office-demo')!==this.adapter.projectId||(context.projectId??'office-demo')!==this.adapter.projectId)throw new Error('Foreign mock project');this.adapter.startOrchestrated(t.agentId,id,t.title,`${context.rootTask}\n${t.description}`,context.workflowId);}
 read(t:WorkflowTask):Execution {if((t.projectId??'office-demo')!==this.adapter.projectId)return {id:t.executionId!,status:'missing',kind:'permanent',error:'Foreign mock project'};
  const task=this.adapter.getTasks().find(x=>x.id===t.executionId),held=this.held.get(t.executionId!);
  if(!task)return {id:t.executionId!,status:'missing'};
  const cp=this.adapter.getCheckpoints().filter(c=>c.taskId===task.id).at(-1);
  return held??{id:task.id,status:task.status==='completed'?'completed':task.status==='failed'?'failed':task.status==='paused'?'paused':'running',kind:task.pauseReason==='limit_reached'?'usage_limit':task.status==='failed'?'recoverable':'pause',checkpointId:cp?.id,result:t.teamSpec?JSON.stringify(this.teamResult(t)):t.id==='plan'?JSON.stringify(mockPlan(this.scenario)):`Mock result: ${t.title}. Dependencies: ${t.dependencies.join(', ')||'none'}. No real Codex execution.`};
 }
 async pause(t:WorkflowTask){if(this.held.has(t.executionId!))this.held.delete(t.executionId!);await this.adapter.action('pause',{agentId:t.agentId,taskId:t.executionId!});}
 async resume(t:WorkflowTask){await this.adapter.action('resume',{agentId:t.agentId,taskId:t.executionId!});}
 async cancel(t:WorkflowTask){if(this.read(t).status==='running'||this.read(t).status==='approval')await this.pause(t);if(this.read(t).status==='paused'){await this.resume(t);this.adapter.dispatch({type:'transition',taskId:t.executionId!,status:'failed'});}if(this.read(t).status==='failed')await this.prepareRetry(t);}
 async resolveApproval(t:WorkflowTask){this.held.delete(t.executionId!);if(this.read(t).status==='running')await this.pause(t);}
 async prepareRetry(t:WorkflowTask){if(this.read(t).status!=='failed')throw new Error('Failure not confirmed');this.adapter.dispatch({type:'agent_status',agentId:t.agentId,status:'idle'});}
 teamResult(t:WorkflowTask){
  if(t.id==='plan'){const make=(id:string,type:'design'|'backend'|'frontend',dependencies:string[],scope:string[])=>({id,type,title:`Mock ${type}`,description:'Implement the scoped acceptance criteria',dependencies,requiredSkills:[capabilities[type].skill],priority:'normal',permissions:['read-only'],acceptance:['Return a tested result'],scope});return {tasks:this.scenario==='team-parallel'?[make('design','design',[],[]),make('api','backend',[],['src/team-api.ts','tests/team-api.test.ts']),make('ui','frontend',['design','api'],['src/team-ui.ts','tests/team-ui.test.ts'])]:[make('api','backend',[],['src/team-api.ts','tests/team-api.test.ts'])]};}
  const kind=t.teamSpec!.kind,round=t.teamSpec!.round;
  const fail=round===0&&(kind==='qa'&&this.scenario==='team-qa-fail'||kind==='review'&&this.scenario==='team-review-reject'||kind==='security'&&this.scenario==='team-security-block');
  const outcome:TeamOutcome={verdict:fail?(kind==='review'?'CHANGES_REQUIRED':kind==='security'?'BLOCKED':'FAIL'):kind==='review'?'APPROVED':'PASS',completedWork:['Mock completed work; no real Codex used'],codeInfo:['Mock contract'],tests:[],findings:fail?[{id:'mock-finding',severity:kind==='security'?'critical':'medium',message:'Deterministic mock finding',responsibleTask:'api',reproduction:'Run the mock scenario',files:['src/team-api.ts']}]:[],patches:kind==='implementation'?[{path:t.teamSpec!.scope[0],before:null,content:'export const mockValue = 1;\n'}]:[],nextAction:fail?'Fix the attributed finding':'Continue to the next required gate'};
  return {summary:'Mock team result',filesChanged:[],decisions:['Mock decision'],warnings:['Simulation only'],unresolved:[],team:outcome};
 }
 async approve(_w:Workflow,t:WorkflowTask,a:Approval){return {filesChanged:a.patches.map(p=>p.path),revision:'a'.repeat(64),tests:a.action==='run_tests'?[{command:a.commands[0],status:'PASS' as const,exitCode:0,output:'Deterministic mock evidence, not real tests',revision:'a'.repeat(64),source:'mock' as const}]:[]};}
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
 private key:string;constructor(projectId='office-demo'){this.key=projectId==='office-demo'?'ai-office-orchestrator-v1':`ai-office-orchestrator-v1:${projectId}`;}
 load(){const raw=localStorage.getItem(this.key);return raw?validateWorkflowBook(JSON.parse(raw),'mock'):emptyWorkflows('mock');}
 save(book:WorkflowBook){localStorage.setItem(this.key,JSON.stringify(validateWorkflowBook(book,'mock')));}
}
