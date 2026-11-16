import {rolePolicies,permissionActions,evaluatePolicy,permissionPolicyVersion} from '../src/security/policy.ts';
import {randomUUID} from 'node:crypto';
/** Context comes from the owned workflow, never from client-supplied role or filesystem scope. */
export class SecurityController {
 constructor(engine,permissions){this.engine=engine;this.permissions=permissions;}
 context(workflowId,taskId){const w=this.engine.snapshot().workflows.find(w=>w.id===workflowId),t=w?.tasks.find(t=>t.id===taskId);if(!t||['completed','cancelled'].includes(w.status)||['completed','cancelled','failed'].includes(t.status))throw new Error('No active owned task');return {workflowId,taskId,agentId:t.agentId,files:t.teamSpec?.scope??[],active:true};}
 snapshot(){return {...this.permissions.snapshot(),available:true,policies:rolePolicies,actions:permissionActions,policyVersion:permissionPolicyVersion,executors:{files:true,terminal:this.permissions.testExecutor?.isolation==='verified',qaTests:this.permissions.testExecutor?.status()??{available:false,reason:'No verified QA executor'},dependency:false,network:false,git:false},taskScopes:this.engine.snapshot().workflows.filter(w=>!['completed','cancelled'].includes(w.status)).flatMap(w=>w.tasks.map(t=>({workflowId:w.id,taskId:t.id,employeeId:t.agentId,files:t.teamSpec?.scope??[],status:t.status})))};}
 async request(data){if(!data||Object.keys(data).some(k=>!['workflowId','taskId','action','resources','reason','command'].includes(k)))throw new Error('Invalid request');const ctx=this.context(data.workflowId,data.taskId),request={...data,id:randomUUID(),agentId:ctx.agentId};
  // This endpoint records escalation requests only; file effects use the exact diff workflow.
  if(!/^(?:terminal\.|dependency\.|network\.)/.test(request.action))throw new Error('Use exact workflow proposal for file effects');
  const decision=this.permissions.evaluate(ctx,request);if(decision.decision==='approval_required')await this.engine.command(ctx.workflowId,'pause');return this.permissions.prepare(ctx,request);
 }
}
