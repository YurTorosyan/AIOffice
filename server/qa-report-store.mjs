import {mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WorkspaceBoundary} from './permissions.mjs';
import {readJson,writeJson} from './durable-json.mjs';
import {safeText} from '../src/security/redaction.ts';
import {identifier} from '../src/orchestration/model.ts';
import {validateQAReportRef} from '../src/orchestration/qa-report.ts';
const sha=x=>createHash('sha256').update(x).digest('hex');
/** Project-owned, immutable diagnostics. Short receipts remain bounded; full text stays here. */
export class QAReportStore {
 constructor(root,projectId){this.boundary=new WorkspaceBoundary(root);this.root=this.boundary.root;this.projectId=projectId;}
 file(id){if(!/^qa-[a-f0-9]{64}$/.test(id))throw Error('Invalid QA artifact ID');return this.boundary.path('.ai-office/qa-reports/'+id+'.json').absolute;}
 validate(row){
  if(!row||row.version!==1||row.projectId!==this.projectId||row.workspaceRoot!==this.root)throw Error('Foreign QA report');
  for(const k of ['operationId','workflowId','taskId'])identifier(row[k]);
  if(row.agentId!=='qa'||!['vitest','build','browser'].includes(row.mode)||!['PASS','FAIL','BLOCKED'].includes(row.status)||typeof row.command!=='string'||row.command.length>500||!/^[a-f0-9]{64}$/.test(row.revision)||typeof row.output!=='string'||row.output.length>128000||safeText(row.output)!==row.output||typeof row.complete!=='boolean'||row.exitCode!==null&&!Number.isInteger(row.exitCode))throw Error('Invalid QA diagnostic report');
  if(row.sha256!==sha(row.output)||row.id!=='qa-'+sha(JSON.stringify({...row,id:undefined})))throw Error('QA report integrity mismatch');return row;
 }
 put(ctx,report){
  if(ctx.projectId!==this.projectId||ctx.agentId!=='qa')throw Error('Foreign QA report owner');
  const output=safeText(String(report.output));if(output.length>128000)throw Error('Full QA report exceeds archive budget');
  const row={version:1,projectId:this.projectId,workspaceRoot:this.root,workflowId:ctx.workflowId,taskId:ctx.taskId,agentId:'qa',operationId:ctx.operationId,mode:report.mode,command:report.command,revision:report.revision,status:report.status,exitCode:report.exitCode,complete:report.complete,output,sha256:sha(output)};
  row.id='qa-'+sha(JSON.stringify(row));this.validate(row);
  const file=this.file(row.id);if(existsSync(file)){const prior=readJson(file,{validate:r=>this.validate(r),maxBytes:1000000}).value;if(JSON.stringify(prior)!==JSON.stringify(row))throw Error('QA report collision');}
  else{mkdirSync(this.boundary.path('.ai-office/qa-reports').absolute,{recursive:true,mode:0o700});writeJson(file,row,{validate:r=>this.validate(r),immutable:true,maxBytes:1000000});}
  return {version:1,id:row.id,sha256:row.sha256,characters:output.length,complete:row.complete};
 }
 get(ref,{workflowId,taskId,command,revision}){
  validateQAReportRef(ref);const row=readJson(this.file(ref.id),{validate:r=>this.validate(r),maxBytes:1000000}).value;
  if(row.workflowId!==workflowId||row.taskId!==taskId||row.command!==command||row.revision!==revision||row.sha256!==ref.sha256||row.output.length!==ref.characters||row.complete!==ref.complete)throw Error('QA report reference binding mismatch');return row;
 }
}

/** Preserve assertion/header plus context tail for display; full report is attached separately. */
export function diagnosticPreview(output,max=5000){const text=safeText(output);if(text.length<=max)return text;const marker='\n[Preview only; full diagnostics are stored in the QA report artifact]\n';const head=Math.floor((max-marker.length)*0.7);return text.slice(0,head)+marker+text.slice(-(max-marker.length-head));}
