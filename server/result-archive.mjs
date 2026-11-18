import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WorkspaceBoundary} from './permissions.mjs';
import {identifier} from '../src/orchestration/model.ts';
import {safeText} from '../src/checkpoints/model.ts';
const sha=s=>createHash('sha256').update(s).digest('hex');
/** Fixed project-owned response artifacts. Never execute or overwrite an archived response. */
export class ResultArchive {
 constructor(root,projectId,workspaceRoot){this.boundary=new WorkspaceBoundary(root);this.projectId=projectId;this.workspaceRoot=workspaceRoot;}
 path(t){identifier(t.executionId);return this.boundary.path('.ai-office/results/'+t.executionId+'.json').absolute;}
 validate(t,row){if(!row||row.projectId!==this.projectId||row.workspaceRoot!==this.workspaceRoot||row.taskId!==t.id||row.executionId!==t.executionId||row.agentId!==t.agentId||typeof row.response!=='string'||!row.response.trim()||row.response.length>128000||safeText(row.response)!==row.response||sha(row.response)!==row.sha256||!Number.isFinite(Date.parse(row.createdAt)))throw new Error('Response archive ownership or hash mismatch');return row;}
 put(t,response,threadId=null){if((t.projectId??'office-demo')!==this.projectId)throw new Error('Foreign response archive');const row=this.validate(t,{projectId:this.projectId,workspaceRoot:this.workspaceRoot,taskId:t.id,executionId:t.executionId,agentId:t.agentId,threadId,response,sha256:sha(response),createdAt:new Date().toISOString()}),file=this.path(t);if(existsSync(file)){const prior=this.get(t);if(prior.response!==response)throw new Error('Archived response changed');return prior;}const dir=this.boundary.path('.ai-office/results').absolute;mkdirSync(dir,{recursive:true});this.path(t);writeFileSync(file,JSON.stringify(row),{flag:'wx',mode:0o600});return row;}
 get(t){if((t.projectId??'office-demo')!==this.projectId)throw new Error('Foreign response archive');const bytes=readFileSync(this.path(t));if(bytes.length>800000)throw new Error('Response archive too large');return this.validate(t,JSON.parse(bytes));}
}
