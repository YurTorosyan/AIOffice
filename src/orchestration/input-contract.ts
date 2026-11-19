import {workflowBudgets} from './budgets.ts';
import type {Context,WorkflowTask} from './model.ts';
/** Complete requirements are a separate hashed snapshot, never the compact prompt preview. */
export function inputContract(t:WorkflowTask,c:Context){
 const contract={version:1,budgetVersion:workflowBudgets.version,workflowId:c.workflowId,taskId:t.id,
  agentId:t.agentId,objective:c.rootTask,title:t.title,description:t.description,
  acceptance:t.teamSpec?.acceptance??[],writeScope:t.teamSpec?.scope??[],
  dependencies:t.dependencies,inputs:c.inputs??null,team:c.team??null};
 const text=JSON.stringify(contract);
 if(text.length>workflowBudgets.maxInputCharacters)throw Object.assign(new Error('Complete task contract exceeds input budget; split delivery without discarding requirements'),{code:'INPUT_CONTRACT_BUDGET'});
 return text;
}
