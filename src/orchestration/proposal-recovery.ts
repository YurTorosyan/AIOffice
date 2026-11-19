import {workflowBudgets} from './budgets.ts';
import type {WorkflowTask} from './model.ts';
import {safeText} from '../checkpoints/model.ts';
export interface ProposalRecovery {executionId:string;originalResponse:string;originalSha256:string;correctedResponse:string;changedPath:string;removedCharacters:number;createdAt:string;}
export function validateProposalRecovery(t:WorkflowTask){
 const r=t.proposalRecovery;if(!r)return;
 if(Object.keys(r).sort().join(',')!=='changedPath,correctedResponse,createdAt,executionId,originalResponse,originalSha256,removedCharacters'||r.executionId!==t.executionId||typeof r.originalResponse!=='string'||typeof r.correctedResponse!=='string'||r.originalResponse.length>workflowBudgets.maxResponseCharacters||r.correctedResponse.length>workflowBudgets.maxResponseCharacters||safeText(r.originalResponse)!==r.originalResponse||safeText(r.correctedResponse)!==r.correctedResponse||! /^[a-f0-9]{64}$/.test(r.originalSha256)||!Number.isFinite(Date.parse(r.createdAt))||!Number.isInteger(r.removedCharacters)||r.removedCharacters<=0)throw new Error('Invalid proposal recovery');
 const original=JSON.parse(r.originalResponse),corrected=JSON.parse(r.correctedResponse),patch=original.team.patches.find((p:{path:string})=>p.path===r.changedPath),fixed=corrected.team.patches.find((p:{path:string})=>p.path===r.changedPath);
 if(!patch||!fixed||!t.teamSpec?.scope.includes(r.changedPath)||patch.content.length-fixed.content.length!==r.removedCharacters)throw new Error('Invalid proposal formatting record');const comparison=structuredClone(original);comparison.team.patches.find((p:{path:string})=>p.path===r.changedPath).content=fixed.content;if(JSON.stringify(comparison)!==JSON.stringify(corrected))throw new Error('Formatting recovery changed other proposal data');
}
