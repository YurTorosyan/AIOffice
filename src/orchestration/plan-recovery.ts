import {workflowBudgets} from './budgets.ts';
import type {Workflow} from './model.ts';
import {inspectTeamPlanForRecovery,parseTeamPlan,projectPath} from './team-workflow.ts';
import {safeText} from '../checkpoints/model.ts';
export interface PlanIssue {code:string;message:string;actual?:number;limit?:number;paths?:string[];}
export interface PlanChange {from:string;to:string;ownerTask:string;downstreamTask:string;}
export interface PlanCandidate {text:string;changes:PlanChange[];filesBefore:number;filesAfter:number;}
export interface PlanResponse {executionId:string;text:string;sha256:string;receivedAt:string;issues:PlanIssue[];}
export interface PlanRecovery {version:1;status:'needs_revision'|'proposal_ready'|'revision_ready'|'applied';responses:PlanResponse[];candidate:PlanCandidate|null;acceptedText:string|null;resolution:'consolidated_tests'|'lead_revision'|null;}
export interface PlanFeedback {executionId:string;response:string;issues:PlanIssue[];}
const rawPlan=(text:string)=>JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
const count=(raw:{tasks:{scope:string[]}[]})=>new Set(raw.tasks.flatMap(t=>t.scope)).size;
export function diagnosePlan(text:string,w:Workflow):PlanIssue[]{
 try{parseTeamPlan(text,w);return [];}catch(e){const message=safeText((e as Error).message).slice(0,1000);if(message==='Project scope exceeds 8 files'){const p=rawPlan(text),paths=[...new Set<string>(p.tasks.flatMap((t:{scope:string[]})=>t.scope))];return [{code:'scope_limit',message,actual:paths.length,limit:8,paths}];}
 return [{code:e instanceof SyntaxError?'invalid_json':/scope|surface|permission|Skill|gate|aliased|limit/i.test(message)?'plan_constraints':/depend|Circular/i.test(message)?'dependencies':'plan_schema',message}];}
}
/** Propose only test-target consolidation along an existing dependency, with no lost task or criterion. */
export function suggestPlanRepair(text:string,w:Workflow):PlanCandidate|null{
 try{
  const inspected=inspectTeamPlanForRecovery(text,w),before=count({tasks:inspected.tasks.map(t=>({scope:t.teamSpec.scope}))});if(before<=8)return null;let raw=rawPlan(text);const changes:PlanChange[]=[];
  const ancestor=(id:string,target:string,seen=new Set<string>()):boolean=>{if(id===target)return true;if(seen.has(target))return false;seen.add(target);return raw.tasks.find((t:{id:string})=>t.id===target)?.dependencies.some((d:string)=>ancestor(id,d,seen))??false;};
  for(let step=0;count(raw)>8&&step<3;step++){
   let next:typeof raw|null=null,change:PlanChange|null=null;
   outer:for(const source of raw.tasks)for(const downstream of raw.tasks){
    if(source.id===downstream.id||source.type!==downstream.type||!['frontend','backend'].includes(source.type)||!ancestor(source.id,downstream.id))continue;
    for(const from of source.scope)for(const to of downstream.scope){if(from===to||!/^tests\/.+\.test\.(tsx|ts|js|mjs)$/.test(from)||from.slice(from.lastIndexOf('.'))!==to.slice(to.lastIndexOf('.'))||!/^tests\/.+\.test\.(tsx|ts|js|mjs)$/.test(to))continue;
     const draft=structuredClone(raw),owner=draft.tasks.find((t:{id:string})=>t.id===source.id),consumer=draft.tasks.find((t:{id:string})=>t.id===downstream.id);
     for(const task of draft.tasks){task.scope=[...new Set(task.scope.map((path:string)=>path===from?to:path))];task.description=task.description.replaceAll(from,to);task.acceptance=task.acceptance.map((criterion:string)=>criterion.replaceAll(from,to));}
     owner.description+=` Store the component suite in shared ${to}; its downstream owner must retain this suite.`;consumer.description+=` Extend shared ${to} without deleting earlier component assertions.`;
     // Full policy/dependency/alias/per-task checks remain active; only the total count is inspected here.
     try{inspectTeamPlanForRecovery(JSON.stringify(draft),w);}catch{continue;}
     if(count(draft)>=count(raw))continue;next=draft;change={from,to,ownerTask:source.id,downstreamTask:downstream.id};break outer;
    }
   }
   if(!next||!change)return null;raw=next;changes.push(change);
  }
  const candidate=JSON.stringify(raw,null,2);parseTeamPlan(candidate,w);return {text:candidate,changes,filesBefore:before,filesAfter:count(raw)};
 }catch{return null;}
}
async function response(text:string,executionId:string,issues:PlanIssue[]):Promise<PlanResponse>{
 if(text.length>workflowBudgets.maxResponseCharacters||safeText(text)!==text)throw new Error('Plan response cannot be safely archived within the bounded recovery store');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return {executionId,text,sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''),receivedAt:new Date().toISOString(),issues};
}
export async function rejectedPlan(text:string,w:Workflow,executionId:string,existing?:PlanRecovery):Promise<PlanRecovery>{
 const issues=diagnosePlan(text,w);if(!issues.length)throw new Error('Plan is valid; no recovery required');const responses=structuredClone(existing?.responses??[]),last=responses.at(-1);if(!last||last.executionId!==executionId){if(responses.length>=3)throw new Error('Plan revision limit reached');responses.push(await response(text,executionId,issues));}else if(last.text!==text)throw new Error('Completed planning response changed');
 const candidate=suggestPlanRepair(text,w);return {version:1,status:candidate?'proposal_ready':'needs_revision',responses,candidate,acceptedText:null,resolution:null};
}
export async function acceptedLeadRevision(text:string,w:Workflow,executionId:string):Promise<PlanRecovery>{
 if(w.planRecovery?.status!=='revision_ready')throw new Error('No requested Lead revision');parseTeamPlan(text,w);const responses=structuredClone(w.planRecovery.responses);if(responses.length>=3)throw new Error('Plan revision limit reached');responses.push(await response(text,executionId,[]));return {version:1,status:'applied',responses,candidate:null,acceptedText:text,resolution:'lead_revision'};
}
export function validatePlanRecovery(r:PlanRecovery,w:Workflow){
 const allowed=['version','status','responses','candidate','acceptedText','resolution'];if(!r||r.version!==1||Object.keys(r).some(k=>!allowed.includes(k))||!['needs_revision','proposal_ready','revision_ready','applied'].includes(r.status)||!Array.isArray(r.responses)||!r.responses.length||r.responses.length>3||new Set(r.responses.map(x=>x.executionId)).size!==r.responses.length)throw new Error('Invalid plan recovery history');
 for(const row of r.responses){if(!row||Object.keys(row).sort().join(',')!=='executionId,issues,receivedAt,sha256,text'||!row.executionId.startsWith(`wf-${w.id}-plan-`)||typeof row.text!=='string'||row.text.length>workflowBudgets.maxResponseCharacters||safeText(row.text)!==row.text||! /^(?:[a-f0-9]{64})$/.test(row.sha256)||!Number.isFinite(Date.parse(row.receivedAt)))throw new Error('Invalid original planning response');validatePlanIssues(row.issues);}
 if(r.candidate){const candidate=r.candidate;if(Object.keys(candidate).sort().join(',')!=='changes,filesAfter,filesBefore,text'||typeof candidate.text!=='string'||candidate.text.length>workflowBudgets.maxResponseCharacters||!Array.isArray(candidate.changes)||!candidate.changes.length||candidate.changes.length>3)throw new Error('Invalid plan correction');const expected=suggestPlanRepair(r.responses.at(-1)!.text,w);if(JSON.stringify(candidate)!==JSON.stringify(expected))throw new Error('Plan correction differs from the verified proposal');for(const c of candidate.changes){projectPath(c.from);projectPath(c.to);}}
 if(r.status==='proposal_ready'&&!r.candidate||r.status==='applied'&&(!w.planned||!r.acceptedText||!r.resolution)||r.status!=='applied'&&(w.planned||r.acceptedText!==null||r.resolution!==null))throw new Error('Plan recovery state mismatch');
 if(r.status==='applied'){parseTeamPlan(r.acceptedText!,w);if(r.resolution==='consolidated_tests'&&r.acceptedText!==r.candidate?.text||r.resolution==='lead_revision'&&r.acceptedText!==r.responses.at(-1)!.text)throw new Error('Unattributed accepted plan');}
}
export function validatePlanIssues(issues:PlanIssue[]){if(!Array.isArray(issues)||issues.length>8)throw new Error('Invalid plan diagnostics');for(const i of issues)if(!i||Object.keys(i).some(k=>!['code','message','actual','limit','paths'].includes(k))||typeof i.code!=='string'||i.code.length>60||typeof i.message!=='string'||i.message.length>1000||safeText(i.message)!==i.message||i.actual!==undefined&&!Number.isInteger(i.actual)||i.limit!==undefined&&!Number.isInteger(i.limit)||i.paths!==undefined&&(!Array.isArray(i.paths)||i.paths.length>96||i.paths.some(p=>typeof p!=='string'||p.length>180)))throw new Error('Invalid plan diagnostic');}
export function validatePlanFeedback(f:PlanFeedback){if(!f||Object.keys(f).sort().join(',')!=='executionId,issues,response'||typeof f.executionId!=='string'||typeof f.response!=='string'||f.response.length>workflowBudgets.maxResponseCharacters||safeText(f.response)!==f.response)throw new Error('Invalid Lead correction feedback');validatePlanIssues(f.issues);}
