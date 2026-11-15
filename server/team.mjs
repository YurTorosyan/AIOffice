import {CheckpointPilot} from './checkpoint-pilot.mjs';
import {FileCheckpointStorage} from './checkpoint-store.mjs';
import {EmployeeCheckpointStorage} from './team-store.mjs';
import {employees,employeeDefinition,loadEmployee,loadEmployeeContext,employeePrompt,roleAuthorization} from './employee-config.mjs';
const active=state=>['starting','working','waiting','interrupting','pausing','resuming'].includes(state.execution);
/** Isolation/lifecycle boundary. Validated orchestration delegates through the same admission gate. */
export class TeamRuntime {
 constructor({root,storage=new FileCheckpointStorage(root),maxActive=Number(process.env.AI_OFFICE_MAX_ACTIVE||2),makePilot,makeRpc,detect}={}){
  if(![1,2].includes(maxActive))throw new Error('AI_OFFICE_MAX_ACTIVE must be 1 or 2');
  this.maxActive=maxActive;this.reserved=new Set();this.teamError=null;this.members=new Map();
  for(const employee of employees){const options={root,runtimeConfig:{'features.shell_tool':false,'features.multi_agent':false,'features.apps':false,'features.plugins':false,'features.hooks':false,'features.skill_mcp_dependency_install':false,'features.memories':false,'web_search':'disabled'},agentId:employee.id,role:employee.role,prompt:employeePrompt(employee),taskTitle:`${employee.role} · Read-only анализ`,profile:`.codex/agents/${employee.profile}.toml`,authorization:roleAuthorization(employee),continuationInstructions:roleAuthorization(employee)+' Continue the same owned task from the validated checkpoint, not from zero.',load:()=>loadEmployee(root,employee.id),context:()=>loadEmployeeContext(root,employee.id),storage:new EmployeeCheckpointStorage(storage,employee.id),...(makeRpc?{makeRpc:()=>makeRpc(employee.id)}:{}),...(detect?{detect}:{})};
   this.members.set(employee.id,makePilot?makePilot(options):new CheckpointPilot(options));}
 }
 snapshot(){const members=Object.fromEntries([...this.members].map(([id,pilot])=>[id,pilot.snapshot()]));return {...members.lead,members,maxActive:this.maxActive,activeEmployees:[...new Set([...this.reserved,...[...this.members].filter(([,p])=>active(p.state)).map(([id])=>id)])],teamError:this.teamError};}
 async action(action,{agentId='lead',taskId,command}={}){
  this.teamError=null;
  if(action==='connect_all'){const results=await Promise.allSettled([...this.members.values()].map(p=>p.connect()));if(results.some(r=>r.status==='rejected'))this.teamError='Часть сотрудников не подключена; подробности в их панелях.';return;}
  if(action==='disconnect_all'){this.disconnect();return;}
  employeeDefinition(agentId);const pilot=this.members.get(agentId);
  if(taskId&&!pilot.book.tasks.some(t=>t.id===taskId&&t.agentId===agentId))throw new Error('Task belongs to another employee');
  const starts=action==='start'||action==='resume'||(action==='control'&&['resume','продолжим работу','продолжить'].includes(command?.trim().toLowerCase()));
  if(starts){this.reserve(agentId);}
  try{
   if(action==='control')return await pilot.control(command,taskId);
   if(action==='resume')return await pilot.resume(taskId);
   if(!['connect','start','pause','interrupt','checkpoint','reject','disconnect'].includes(action))throw new Error('Unknown employee action');
   return await pilot[action==='reject'?'rejectApproval':action]();
  }finally{if(starts)this.reserved.delete(agentId);}
 }
 reserve(agentId){const owners=new Set([...this.reserved,...[...this.members].filter(([,p])=>active(p.state)).map(([id])=>id)]);if(owners.has(agentId)||owners.size>=this.maxActive){this.teamError=`Заняты слоты выполнения (${this.maxActive}). Дождитесь завершения или приостановите задание.`;throw new Error('Execution capacity reached');}this.reserved.add(agentId);}
 async startWork(agentId,{id,title,prompt}){
  employeeDefinition(agentId);if(!/^wf-[a-zA-Z0-9_.:-]{1,156}$/.test(id)||typeof title!=='string'||title.length>160||typeof prompt!=='string'||prompt.length>10000)throw new Error('Invalid orchestrated work');
  const p=this.members.get(agentId);if(p.book.tasks.some(t=>t.id===id))throw new Error('Execution ID already exists');this.reserve(agentId);
  const previous={prompt:p.prompt,taskTitle:p.taskTitle,taskIdentifier:p.taskIdentifier};
  try{Object.assign(p,{prompt,taskTitle:title,taskIdentifier:id});await p.start();}finally{Object.assign(p,previous);this.reserved.delete(agentId);}
 }
 disconnect(){for(const pilot of this.members.values())pilot.disconnect();}
}
