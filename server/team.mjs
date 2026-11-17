import {resolveControl} from '../src/checkpoints/model.ts';
import {CheckpointPilot} from './checkpoint-pilot.mjs';
import {FileCheckpointStorage} from './checkpoint-store.mjs';
import {EmployeeCheckpointStorage} from './team-store.mjs';
import {employees,employeeDefinition,employeeContextPaths,loadEmployee,employeePrompt,roleAuthorization} from './employee-config.mjs';
import {existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {PermissionAuthority,MemoryPermissionStorage} from './permissions.mjs';
import {createHash} from 'node:crypto';
import {rolePolicies} from '../src/security/policy.ts';
const active=state=>['starting','working','waiting','interrupting','pausing','resuming'].includes(state.execution);
/** Isolation/lifecycle boundary. Validated orchestration delegates through the same admission gate. */
export class TeamRuntime {
 constructor({root,serviceRoot=root,projectContext,validateProject,storage=new FileCheckpointStorage(root),maxActive=Number(process.env.AI_OFFICE_MAX_ACTIVE||2),makePilot,makeRpc,detect,permissions,confinedExecutor}={}){
  if(![1,2].includes(maxActive))throw new Error('AI_OFFICE_MAX_ACTIVE must be 1 or 2');
  this.root=root;this.serviceRoot=serviceRoot;this.projectContext=projectContext;this.projectId=projectContext?.projectId??'office-demo';this.validateProject=validateProject;this.testExecutor=confinedExecutor;this.permissions=permissions??new PermissionAuthority(root,{projectId:this.projectId,executable:r=>['file.read','file.create','file.modify','directory.create'].includes(r.action)||r.action==='terminal.safe'&&r.agentId==='qa'&&r.command?.profile==='node_tests'&&confinedExecutor?.isolation==='verified',...(makeRpc||makePilot||detect?{storage:new MemoryPermissionStorage()}:{} )});this.permissions.testExecutor=confinedExecutor;this.maxActive=maxActive;this.reserved=new Set();this.teamError=null;this.members=new Map();
  for(const employee of employees){const options={root,projectId:this.projectId,projectContext,discoveryRoot:serviceRoot,runtimeConfig:{'features.shell_tool':false,'features.multi_agent':false,'features.apps':false,'features.plugins':false,'features.hooks':false,'features.skill_mcp_dependency_install':false,'features.memories':false,'web_search':'disabled'},agentId:employee.id,role:employee.role,prompt:employeePrompt(employee),taskTitle:`${employee.role} · Read-only анализ`,profile:serviceRoot===root?`.codex/agents/${employee.profile}.toml`:resolve(serviceRoot,`.codex/agents/${employee.profile}.toml`),['authorization']:roleAuthorization(employee),continuationInstructions:roleAuthorization(employee)+' Continue the same owned task from the validated checkpoint, not from zero.',load:()=>this.loadProfile(employee.id),context:()=>this.loadContext(employee.id),storage:new EmployeeCheckpointStorage(storage,employee.id),...(makeRpc?{makeRpc:()=>makeRpc(employee.id)}:{}),...(detect?{detect}:{})};
   this.members.set(employee.id,makePilot?makePilot(options):new CheckpointPilot(options));}
 }
 permissionContext(agentId,baselineFiles=[]){return {projectId:this.projectId,...(this.members.get(agentId)?.securityContext??{workflowId:'office-demo',taskId:`context-${agentId}`,agentId,files:[],active:true}),baselineFiles};}
 loadProfile(agentId){const p=loadEmployee(this.serviceRoot,agentId),paths=[`.codex/agents/${employeeDefinition(agentId).profile}.toml`,...p.skills.map(s=>relative(this.serviceRoot,s.path).replaceAll('\\','/'))],external=this.serviceRoot!==this.root,ctx=this.permissionContext(agentId,paths.map(path=>external?'@service/'+path:path));for(const path of paths){if(external)this.permissions.readReferenceFile(ctx,path,this.serviceRoot);else this.permissions.readFile(ctx,path);}return p;}
 loadContext(agentId){const external=this.serviceRoot!==this.root,paths=external?['AGENTS.md','README.md','package.json'].filter(path=>existsSync(resolve(this.root,path))):employeeContextPaths(agentId),profile=`.codex/agents/${employeeDefinition(agentId).profile}.toml`,ctx=this.permissionContext(agentId,[...paths,...(external?['@service/'+profile]:[])]),files=paths.map(path=>this.permissions.readFile(ctx,path));if(external)files.push(this.permissions.readReferenceFile(ctx,profile,this.serviceRoot));if(this.projectContext){const text=JSON.stringify({...this.projectContext,activeTaskId:this.members.get(agentId)?.state.taskId??null,relevantSkills:employeeDefinition(agentId).skills});files.push({path:'project/context.json',text,sha256:createHash('sha256').update(text).digest('hex')});}if(agentId==='security'){const audit=this.permissions.snapshot(),text=JSON.stringify({source:'broker-generated redacted security view',policies:rolePolicies,records:audit.records.slice(-12),events:audit.events.slice(-24),error:audit.error});files.push({path:'security/permission-audit.json',text,sha256:createHash('sha256').update(text).digest('hex')});}return files;}

 snapshot(){const members=Object.fromEntries([...this.members].map(([id,pilot])=>[id,pilot.snapshot()]));return {...members.lead,projectId:this.projectId,projectContext:this.projectContext,members,maxActive:this.maxActive,activeEmployees:[...new Set([...this.reserved,...[...this.members].filter(([,p])=>active(p.state)).map(([id])=>id)])],teamError:this.teamError};}
 async action(action,{agentId='lead',taskId,command,projectId}={}){
  if(projectId&&projectId!==this.projectId)throw new Error('Wrong project');const resume=action==='resume'||action==='control'&&resolveControl(command)==='resume';if(['connect_all','connect','start','resume'].includes(action)||resume)this.validateProject?.();if(resume){const p=this.members.get(agentId),task=p?.book.tasks.find(t=>t.id===(taskId??p.state.taskId));if(task?.branch!==undefined&&task.branch!==this.projectContext?.currentBranch)throw new Error('Checkpoint branch changed; return to the original branch before resuming');}
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
 async startWork(agentId,{id,title,prompt,context,outputSchema,permissionContext}){
  this.validateProject?.();if(permissionContext?.projectId&&permissionContext.projectId!==this.projectId)throw new Error('Foreign project task');employeeDefinition(agentId);if(!/^wf-[a-zA-Z0-9_.:-]{1,156}$/.test(id)||typeof title!=='string'||title.length>160||typeof prompt!=='string'||prompt.length>10000)throw new Error('Invalid orchestrated work');
  const p=this.members.get(agentId);if(p.book.tasks.some(t=>t.id===id))throw new Error('Execution ID already exists');this.reserve(agentId);
  const previous={prompt:p.prompt,taskTitle:p.taskTitle,taskIdentifier:p.taskIdentifier,context:p.context,outputSchema:p.outputSchema,securityContext:p.securityContext};
  try{Object.assign(p,{prompt,taskTitle:title,taskIdentifier:id,outputSchema,securityContext:permissionContext,...(context?{context}:{})});await p.start();}finally{Object.assign(p,previous);this.reserved.delete(agentId);}
 }
 disconnect(){for(const pilot of this.members.values())pilot.disconnect();}
}
