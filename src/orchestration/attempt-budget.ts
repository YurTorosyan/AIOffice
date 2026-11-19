import type {Workflow,WorkflowTask} from './model.ts';
/** New continuation IDs cannot reset the original execution/retry budget. Corrective rounds are separate, bounded deliveries. */
export function lineageAttempts(w:Workflow,t:WorkflowTask){
 const ids=new Set<string>();
 const visit=(task:WorkflowTask)=>{
  if(ids.has(task.id))return;ids.add(task.id);
  if(!/(?:-context-[12]|-evidence-\d+)$/.test(task.id)&&!/^design-retry-\d+$/.test(task.id))return;
  for(const id of task.teamSpec?.remediationFor??[]){const source=w.tasks.find(x=>x.id===id);if(source&&source.agentId===task.agentId&&source.teamSpec?.kind===task.teamSpec?.kind)visit(source);}
 };
 visit(t);return {taskIds:[...ids],attempts:w.tasks.filter(x=>ids.has(x.id)).reduce((n,x)=>n+x.attempts,0),maxAttempts:3};
}
