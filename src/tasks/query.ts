export interface TaskQuery {
  projectId?:string; agentId?:string; status?:string; priority?:string; workflowId?:string;
  createdAfter?:string; createdBefore?:string; updatedAfter?:string; updatedBefore?:string;
}
export interface QueryableTask {
  projectId:string; agentId?:string|null; assignedAgent?:string|null; status:string; priority:string;
  workflowId?:string; createdAt:string; updatedAt?:string;
}
/** A query filters already scoped data; it never grants access to another project. */
export function queryTasks<T extends QueryableTask>(tasks:T[],filter:TaskQuery={}):T[] {
  const keys=['projectId','agentId','status','priority','workflowId','createdAfter','createdBefore','updatedAfter','updatedBefore'];
  for(const [key,value] of Object.entries(filter)) {
    if(!keys.includes(key)||typeof value!=='string'||value.length>160)throw new Error('Invalid task query');
    if(/After$|Before$/.test(key)&&!Number.isFinite(Date.parse(value)))throw new Error('Invalid query timestamp');
  }
  return tasks.filter(t=>(!filter.projectId||t.projectId===filter.projectId)&&
    (!filter.agentId||(t.agentId??t.assignedAgent)===filter.agentId)&&(!filter.status||t.status===filter.status)&&
    (!filter.priority||t.priority===filter.priority)&&(!filter.workflowId||t.workflowId===filter.workflowId)&&
    (!filter.createdAfter||Date.parse(t.createdAt)>=Date.parse(filter.createdAfter))&&
    (!filter.createdBefore||Date.parse(t.createdAt)<=Date.parse(filter.createdBefore))&&
    (!filter.updatedAfter||Date.parse(t.updatedAt??t.createdAt)>=Date.parse(filter.updatedAfter))&&
    (!filter.updatedBefore||Date.parse(t.updatedAt??t.createdAt)<=Date.parse(filter.updatedBefore)));
}
