import {workflowBudgets} from './budgets.ts';
export const durabilityVersion=1 as const;
export type EffectState='prepared'|'running'|'unknown'|'conflict'|'completed';
export interface ResponseRef {artifactId?:string;version:1;executionId:string;sha256:string;characters:number;contentStatus:'complete'|'redacted'|'truncated'|'unavailable';}
export interface RecoveryIssue {code:string;message:string;phase:string;outcome:'not_committed'|'unknown';}
export const validHash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validateResponseRef(value:ResponseRef){if(!value||value.version!==1||Object.keys(value).filter(k=>k!=='artifactId').sort().join(',')!=='characters,contentStatus,executionId,sha256,version'||typeof value.executionId!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(value.executionId)||!validHash(value.sha256)||!Number.isInteger(value.characters)||value.characters<0||value.characters>workflowBudgets.maxResponseCharacters||!['complete','redacted','truncated','unavailable'].includes(value.contentStatus))throw new Error('Invalid durable response reference');if(value.artifactId!==undefined&&(!value.artifactId.startsWith(value.executionId+'--turn-')||! /^[a-zA-Z0-9_.:-]{1,260}$/.test(value.artifactId)))throw new Error('Invalid response artifact identity');return value;}
