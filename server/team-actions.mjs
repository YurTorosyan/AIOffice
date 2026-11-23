import {BuildArtifacts} from './build-artifacts.mjs';
import {QAReportStore} from './qa-report-store.mjs';
import {validateTest} from '../src/orchestration/team-workflow.ts';
import {workflowBudgets,proposalBudget} from '../src/orchestration/budgets.ts';
import {OperationStore,operationFingerprint} from './operation-store.mjs';
import {inspectOperation} from './operation-reconciler.mjs';
import {webRegistration} from './qa-web-profiles.mjs';
import {webScope,webSupportFiles,webVerificationIdentity,webCommands,webSnapshot} from './qa-web.mjs';
import {qaSupports,nodeVerificationIdentity} from './qa-executor.mjs';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,lstatSync,mkdirSync,realpathSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {replaceFile} from './atomic-replace.mjs';
import {resolve,relative,dirname} from 'node:path';
import {PermissionAuthority,PermissionDenied} from './permissions.mjs';
import {projectPath} from '../src/orchestration/team-workflow.ts';
import {identifier} from '../src/orchestration/model.ts';
import {safeText} from '../src/checkpoints/model.ts';
const sha=s=>createHash('sha256').update(s).digest('hex');
/** No shell or agent-provided command strings. File effects require a durable, exact Director approval. */
export class TeamActions {
 constructor(root,{permissions,confinedExecutor,failpoint=()=>{}}={}){this.root=realpathSync(root);this.confinedExecutor=confinedExecutor;this.permissions=permissions??new PermissionAuthority(root);this.failpoint=failpoint;this.reports=new QAReportStore(this.root,this.permissions.projectId);this.operations=new OperationStore(this.root,this.permissions.projectId,{failpoint});this.run=this.runTests.bind(this);this.dir=resolve(this.root,'.ai-office/team-actions');}
 context(w,t){const projectId=w.projectId??t.projectId??'office-demo';if(projectId!==this.permissions.projectId||t.projectId&&t.projectId!==projectId)throw new PermissionDenied('Foreign project task');return {projectId,workflowId:w.id,taskId:t.id,agentId:t.agentId,files:t.teamSpec?.scope??[],active:!['completed','cancelled'].includes(w.status)&&t.status!=='cancelled'};}
 requests(w,t,a,retainPreparedDirectories=false){const ctx=this.context(w,t),base={projectId:ctx.projectId,workflowId:w.id,taskId:t.id,agentId:t.agentId};const requests=[];
  // Keep the exact prepared directory operations even if another approved task created them.
  // Reconstruct only ledger-bound parents of this proposal; never drop file/digest checks.
  const preparedDirectories=new Set(retainPreparedDirectories?(this.permissions.snapshot().records.filter(r=>a.security?.requestIds.includes(r.request.id)&&r.request.action==='directory.create'&&r.request.projectId===ctx.projectId&&r.request.workflowId===w.id&&r.request.taskId===t.id&&r.request.agentId===t.agentId).flatMap(r=>r.request.resources)):[]);
  const recovery=a.recovery?this.inspect(w,t,a):null;if(recovery&&recovery.planHash!==a.recovery.planHash)throw new Error('Recovery observation changed; inspect again');
  if(a.action==='apply_changes')for(const [i,p] of a.patches.entries()){
   if(recovery?.resources.find(r=>r.path===p.path)?.observation==='after')continue;
   const parent=p.path.split('/').slice(0,-1).join('/');if(parent)for(let n=1;n<=parent.split('/').length;n++){const dir=parent.split('/').slice(0,n).join('/'),target=this.permissions.boundary.path(dir),exists=existsSync(target.absolute);if(exists&&!lstatSync(target.absolute).isDirectory())throw new PermissionDenied('Parent path is not a directory');if((!exists||preparedDirectories.has(target.resource))&&!requests.some(r=>r.action==='directory.create'&&r.resources[0]===dir))requests.push({...base,id:`${a.id}-dir-${requests.length}`,action:'directory.create',resources:[dir],reason:'Create parent for exact approved file'});}
   requests.push({...base,id:`${a.id}-file-${i}`,action:p.before===null?'file.create':'file.modify',resources:[p.path],reason:'Exact patch digest '+sha(JSON.stringify(p))});
  }else if(a.action==='run_tests'){const profile=webScope(t.teamSpec.scope)?webRegistration(this.webRegistration()).permission:'node_tests',files=t.teamSpec.scope.filter(p=>(profile!=='node_tests'?/^tests\/.+\.test\.(?:tsx|ts|mjs|js)$/:/^tests\/.+\.test\.(?:ts|mjs|js)$/).test(p));requests.push({...base,id:`${a.id}-tests`,action:'terminal.safe',resources:files,reason:'Run '+profile+' against revision '+this.verificationRevision(t.teamSpec.scope),command:{profile,files}});}
  else throw new PermissionDenied('Unknown action');return {ctx,requests};
 }
 prepare(w,t,a){try{const {ctx,requests}=this.requests(w,t,a);if(!requests.length)throw new PermissionDenied('No scoped operation');const prepared=requests.map(r=>this.permissions.prepare(ctx,r));return {decision:'approval_required',risk:prepared.some(p=>p.decision.risk==='dangerous')?'dangerous':'sensitive',reason:'Exact operations require Director approval',expiresAt:prepared.map(p=>p.record.expiresAt).sort()[0],requestIds:requests.map(r=>r.id)};}catch(e){this.permissions.event('action_denied',{agentId:t.agentId,workflowId:w.id,taskId:t.id,action:a.action==='run_tests'?'terminal.safe':'file.modify',resources:[]},'Project action blocked before execution');return {decision:'denied',risk:'dangerous',reason:e.message,expiresAt:new Date().toISOString(),requestIds:[]};}}
 reject(w,t,a){const {ctx,requests}=this.requests(w,t,a,true);for(const r of requests){try{this.permissions.decide(ctx,r,false);}catch{/* A denied/expired request stays denied. */}}}
 checked(path){projectPath(path);const full=resolve(this.root,path);let at=this.root;for(const part of relative(this.root,full).split(/[\\/]/)){at=resolve(at,part);if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw new Error('Symlink in project path');}if(relative(this.root,full).startsWith('..'))throw new Error('Escaping project path');return full;}
 journal(id){identifier(id);let at=this.root;for(const p of ['.ai-office','team-actions']){at=resolve(at,p);if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw new Error('Unsafe action journal');}mkdirSync(this.dir,{recursive:true,mode:0o700});const file=resolve(this.dir,id+'.json');if(existsSync(file)&&lstatSync(file).isSymbolicLink())throw new Error('Unsafe receipt');return file;}
 revision(scope){return sha(JSON.stringify([...new Set(scope)].sort().map(path=>{const file=this.checked(path);return [path,existsSync(file)?sha(readFileSync(file)):null];})));}
 webRegistration(){const file=this.permissions.boundary.path('package.json').absolute;return existsSync(file)?webRegistration(JSON.parse(readFileSync(file,'utf8')).name).name:'coffee-house';}
 verificationRevision(scope){if(!webScope(scope))return sha(JSON.stringify({profile:nodeVerificationIdentity(),sources:this.revision(scope),configuration:['package.json','package-lock.json','tsconfig.json'].map(path=>{const file=this.permissions.boundary.path(path).absolute;return [path,existsSync(file)?sha(readFileSync(file)):null];})}));const registration=this.webRegistration(),paths=[...new Set([...scope,...webSupportFiles,...(registration==='armgarage'?['README.md']:[])])].sort();return sha(JSON.stringify({profile:webVerificationIdentity(registration),files:paths.map(path=>{const file=this.permissions.boundary.path(path).absolute;return [path,existsSync(file)?sha(readFileSync(file)):null];})}));}
 validatePlan(w){
  const implementations=w.tasks.filter(t=>t.teamSpec?.kind==='implementation'&&t.status!=='cancelled');if(w.design&&!implementations.length&&w.tasks.every(t=>t.type==='design'&&t.agentId==='design'&&t.teamSpec?.scope.length===0))return;const scope=[...new Set(implementations.flatMap(t=>t.teamSpec.scope))];
  if(!scope.some(p=>/^tests\/.+\.test\.(?:ts|tsx|js|mjs)$/.test(p)))throw Error('Plan has no executable test path; include tests within the existing 8-file budget');
  const profile=webScope(scope)?webRegistration(this.webRegistration()).permission:'node_tests';
  if(!qaSupports(this.confinedExecutor,profile))throw Error('Required isolated '+profile+' profile is unavailable; accepted plan retained, no specialist started');
  if(profile!=='node_tests')for(const path of webSupportFiles)if(!existsSync(this.permissions.boundary.path(path).absolute))throw Error('Registered web setup missing: '+path+'; dependency installation is not authorized');
  const expected=new Map();for(const a of w.team.approvals.filter(a=>a.action==='apply_changes'&&a.status==='approved').sort((a,b)=>Date.parse(a.resolvedAt)-Date.parse(b.resolvedAt)))for(const patch of a.patches)expected.set(patch.path,sha(patch.content));for(const [path,hash] of expected){const file=this.checked(path);if(!existsSync(file)||sha(readFileSync(file))!==hash)throw Error('Applied dependency changed or missing: '+path);}
  for(const t of implementations)for(const path of t.teamSpec.scope){const ctx=this.context(w,t),decision=this.permissions.evaluate(ctx,{id:'plan-preflight',projectId:ctx.projectId,workflowId:w.id,taskId:t.id,agentId:t.agentId,action:'file.create',resources:[path],reason:'Read-only plan feasibility check'});if(decision.decision==='denied')throw Error('Plan scope denied for '+t.agentId+': '+path);}
 }
 approvalCommands(t){const files=t.teamSpec.scope.filter(p=>/^tests\/.+\.test\.(?:tsx|ts|mjs|js)$/.test(p));return webScope(t.teamSpec.scope)?webCommands(files,this.webRegistration()):['node --experimental-strip-types --test '+files.join(' ')];}
 snapshots(scope,ctx){if(!ctx)throw new PermissionDenied('Task context required for source snapshots');return [...new Set(scope)].map(path=>{const f=this.checked(path);if(!existsSync(f)){this.permissions.authorize(ctx,{id:crypto.randomUUID(),workflowId:ctx.workflowId,taskId:ctx.taskId,agentId:ctx.agentId,action:'file.read',resources:[path],reason:'Check scoped missing file'});return {path,sha256:'0'.repeat(64),text:'FILE DOES NOT EXIST. A new-file proposal must use before=null.'};}const snapshot=this.permissions.readFile(ctx,path);if(snapshot.text.length>24000)throw new Error('Scoped snapshot too large');return snapshot;});}
 preview(t){if((t.projectId??'office-demo')!==this.permissions.projectId)throw new PermissionDenied('Foreign project preview');return Object.fromEntries(t.result.team.patches.map(p=>{const f=this.checked(p.path);const text=existsSync(f)?readFileSync(f,'utf8'):null;if(text!==null&&safeText(text)!==text)throw new Error('Sensitive original file');if((text===null?null:sha(text))!==p.before)throw new Error('Stale proposal before approval');return [p.path,text];}));}
 async approve(w,t,a){try{return await this.applyApproved(w,t,a);}catch(e){if(!this.permissions.error)this.permissions.event('action_failed',{agentId:t.agentId,workflowId:w.id,taskId:t.id,action:a.action==='run_tests'?'terminal.safe':'file.modify',resources:[]},'Project action failed closed; inspect proposal and audit before retry');throw e;}}
 inspect(w,t,a){return inspectOperation(this.operations,a.recovery?.operationId??a.operationId??a.id,{projectId:w.projectId??t.projectId??'office-demo',workflowId:w.id,taskId:t.id});}
 operationPayload(w,t,a){return {projectId:w.projectId??t.projectId??'office-demo',workflow:w.id,task:t.id,action:a.action,patches:a.patches,previous:a.previous,commands:a.commands,scope:t.teamSpec.scope};}
 async applyApproved(w,t,a){
  if(w.design&&!w.design.conceptApproved&&a.action==='apply_changes'&&(t.type==='frontend'||t.teamSpec.scope.some(p=>/\.(tsx|css)$/.test(p))))throw Error('Approve a visual concept before UI application');
  if(a.status!=='pending'||a.taskId!==t.id||a.employeeId!==t.agentId)throw new Error('Invalid action owner');
  const id=a.recovery?.operationId??a.operationId??a.id,payload=this.operationPayload(w,t,a),fingerprint=operationFingerprint(payload),existing=this.operations.maybe(id);
  if(existing&&(existing.fingerprint!==fingerprint||existing.workflowId!==w.id||existing.taskId!==t.id))throw new Error('Operation payload changed');
  if(existing?.state==='completed')return existing.receipt;
  const legacyFile=this.journal(a.id),legacy=existsSync(legacyFile)?JSON.parse(readFileSync(legacyFile,'utf8')):null;
  if(legacy){const old=sha(JSON.stringify({workflow:w.id,task:t.id,action:a.action,patches:a.patches,previous:a.previous,commands:a.commands,scope:t.teamSpec.scope}));if(legacy.fingerprint!==old)throw new Error('Legacy approval payload changed');if(legacy.status==='completed')return legacy.receipt;throw new Error('Legacy incomplete operation requires explicit inspection; no automatic replay');}
  if(!a.security||a.security.decision==='denied')throw new PermissionDenied(a.security?.reason??'Legacy approval needs current policy');if(Date.now()>Date.parse(a.security.expiresAt))throw new PermissionDenied('Approval expired');
  if(a.supersedesOperationId){const prior=this.operations.get(a.supersedesOperationId);if(prior.workflowId!==w.id||prior.taskId!==t.id||prior.action!=='run_tests'||(await this.inspectQA(prior)).state!=='new_test_approval')throw new Error('Previous QA execution is not confirmed stopped');}
  const {ctx,requests}=this.requests(w,t,a,true);if(JSON.stringify(requests.map(r=>r.id))!==JSON.stringify(a.security.requestIds))throw new PermissionDenied('Approval resources changed');
  this.permissions.checkBatch(ctx,requests);
  if(existing&&!a.recovery)throw new Error('Operation requires explicit reconciliation before any remaining effect');
  if(a.recovery&&(!existing||existing.action!=='apply_changes'))throw new Error('Only owned file effects can resume after reconciliation');
  if(a.action==='apply_changes')proposalBudget(a.patches);
  if(a.action==='apply_changes')for(const p of a.patches){projectPath(p.path);if(!t.teamSpec.scope.includes(p.path)||typeof p.content!=='string'||p.content.length>workflowBudgets.maxCharactersPerPatchFile||safeText(p.content)!==p.content)throw new Error('Invalid or sensitive patch');const file=this.checked(p.path),current=existsSync(file)?sha(readFileSync(file)):null;if(current!==p.before&&!(a.recovery&&current===sha(p.content)))throw new Error('Stale file; request a new proposal');}
  const {row}=existing?{row:existing}:this.operations.create({id,workflowId:w.id,taskId:t.id,agentId:t.agentId,action:a.action,fingerprint,payload,approvalIds:[a.id],resources:a.patches.map(p=>({path:p.path,before:p.before,after:sha(p.content),state:'pending'}))});
  try{
   this.permissions.consumeBatch(ctx,requests,id);if(a.supersedesOperationId)this.operations.update(a.supersedesOperationId,{retiredByOperationId:id});this.failpoint('grants_consumed',row);this.operations.update(id,{state:'running',approvalIds:[...new Set([...row.approvalIds,a.id])]});this.failpoint('before_effect',row);let receipt;
   if(a.action==='apply_changes'){
    for(const p of a.patches){const file=this.checked(p.path),current=existsSync(file)?sha(readFileSync(file)):null,after=sha(p.content);if(current!==p.before&&current!==after)throw new Error('File changed during application');
     if(current!==after){mkdirSync(dirname(file),{recursive:true});this.checked(p.path);const temp=file+'.ai-office-'+id+'.tmp';if(existsSync(temp))throw new Error('Unconfirmed temporary file; reconcile before retry');writeFileSync(temp,p.content,{flag:'wx',mode:0o600});const fd=openSync(temp,'r+');try{fsyncSync(fd);}finally{closeSync(fd);}replaceFile(temp,file);this.failpoint('file_replaced',{...row,path:p.path});this.operations.markResource(id,p.path,'confirmed');}
     else this.operations.markResource(id,p.path,'observed');this.failpoint('resource_recorded',{...row,path:p.path});
    }
    receipt={filesChanged:a.patches.map(p=>p.path),tests:[],revision:this.revision(t.teamSpec.scope)};
   }else if(a.action==='run_tests'){
    this.operations.update(id,{executorProtocol:this.confinedExecutor?.operationProtocol??'unknown'});const revision=this.verificationRevision(t.teamSpec.scope),runCtx={...ctx,operationId:id,recordContainer:container=>{const live=this.operations.get(id);this.operations.update(id,{containers:[...live.containers.filter(c=>c.name!==container.name),container]});}};const tests=await this.run(t.teamSpec.scope,revision,runCtx);if(this.verificationRevision(t.teamSpec.scope)!==revision)throw new Error('Files/configuration changed during tests');receipt={filesChanged:[],tests,revision};
   }else throw new Error('Unknown action');
   if(a.action==='run_tests'&&this.operations.get(id).containers.some(c=>!c.cleanupConfirmed))throw new Error('QA container outcome unknown; inspect owned operation before any rerun');
   this.failpoint('before_receipt',row);this.operations.update(id,{state:'completed',receipt});this.failpoint('after_receipt',row);for(const request of requests)this.permissions.event('action_executed',request,'Exact approved operation completed');return receipt;
  }catch(error){try{const live=this.operations.get(id);if(live.state!=='completed')this.operations.update(id,{state:'unknown',lastError:'Effect interrupted; explicit reconciliation required'});}catch{}throw error;}
 }
 pendingEffects(){return this.operations.list().filter(r=>r.state!=='completed'&&!r.retiredByOperationId&&r.action==='run_tests'&&r.containers.some(c=>!c.cleanupConfirmed)).map(r=>r.id);}
 async inspectQA(row){if(row.action!=='run_tests')throw new Error('Only QA operation inspection');if(!row.containers.length){if(row.executorProtocol!=='owned-containers-v1')throw new Error('Cannot prove previous QA stopped without owned executor records');return {operationId:row.id,planHash:operationFingerprint({revision:row.revision}),state:'new_test_approval',resources:[]};}const observations=[];for(const c of row.containers){if(c.cleanupConfirmed){observations.push({name:c.name,state:'absent'});continue;}if(!this.confinedExecutor?.inspectOwned)throw new Error('Owned executor inspection unavailable; no replay');observations.push({name:c.name,...await this.confinedExecutor.inspectOwned(c)});}return {operationId:row.id,planHash:operationFingerprint({revision:row.revision,observations}),state:observations.every(o=>o.state==='absent')?'new_test_approval':'cleanup_required',resources:[],observations};}
 async cleanupOperation(w,t,a,preview){const row=this.operations.get(preview.operationId);if(row.projectId!==this.permissions.projectId||row.workflowId!==w.id||row.taskId!==t.id)throw new Error('Foreign QA cleanup');const plan=await this.inspectQA(row);if(plan.planHash!==preview.planHash||plan.state!=='cleanup_required'||!this.confinedExecutor?.cleanupOwned)throw new Error('Owned cleanup observation changed or unavailable');for(const c of row.containers){if(!c.cleanupConfirmed)await this.confinedExecutor.cleanupOwned(c);}this.operations.update(row.id,{containers:row.containers.map(c=>({...c,cleanupConfirmed:true}))});return this.inspectQA(this.operations.get(row.id));}
 prepareRecovery(w,t,a){const plan=this.inspect(w,t,a);if(plan.state==='unknown')return this.inspectQA(this.operations.get(plan.operationId));if(plan.state==='conflict')throw new Error('User file changed; recovery will not overwrite it');return plan;}
 reconcileMetadata(w,t,a,preview){const plan=this.inspect(w,t,a);if(plan.planHash!==preview.planHash||!['completed','metadata_only'].includes(plan.state))throw new Error('Recovery observation changed or effects remain');if(plan.state==='completed')return plan.receipt;const op=this.operations.get(plan.operationId),receipt={filesChanged:op.payload.patches.map(p=>p.path),tests:[],revision:this.revision(t.teamSpec.scope)};this.operations.update(op.id,{state:'completed',resources:op.resources.map(r=>({...r,state:'observed'})),receipt,observationConfirmedBy:'director'});return receipt;}
 reportSnapshots(t,context){
  const refs=[...(t.teamSpec?.testEvidence??[]).map(e=>({taskId:t.id,e})),...(context.inputs?.handoffs??[]).flatMap(h=>(h.tests??[]).map(e=>({taskId:h.taskId,e})))],snapshots=[],seen=new Set();let size=0;
  for(const {taskId,e} of refs){if(!e.report)continue;
   const reportOwner=e.reportOwnerTaskId??taskId;const row=this.reports.get(e.report,{workflowId:context.workflowId,taskId:reportOwner,command:e.command,revision:e.revision}),op=this.operations.get(row.operationId);
   if(op.state!=='completed'||op.action!=='run_tests'||op.workflowId!==row.workflowId||op.taskId!==row.taskId||op.agentId!=='qa'||!op.receipt.tests.some(x=>x.command===e.command&&x.revision===e.revision&&JSON.stringify(x.report)===JSON.stringify(e.report))||row.status!==e.status||row.exitCode!==e.exitCode)throw Error('QA report has no matching committed runner receipt');
   if(seen.has(e.report.id))continue;seen.add(e.report.id);
   const text=JSON.stringify(row);size+=text.length;if(size>200000)throw Error('Full QA diagnostic snapshot budget exceeded; split context without truncating reports');
   snapshots.push({path:'project/qa-reports/'+row.id+'.json',text,sha256:sha(text)});
  }return snapshots;
 }
 async runTests(scope,revision,ctx){
  const profile=webScope(scope)?webRegistration(this.webRegistration()).permission:'node_tests',files=scope.filter(path=>(profile!=='node_tests'?/^tests\/[a-zA-Z0-9_./-]+\.test\.(?:tsx|ts|mjs|js)$/:/^tests\/[a-zA-Z0-9_./-]+\.test\.(?:ts|mjs|js)$/).test(path)),command=profile!=='node_tests'?webCommands(files,this.webRegistration())[0]:'node --experimental-strip-types --test '+files.join(' ');
  const blocked=output=>[{command,status:'BLOCKED',exitCode:null,output,revision,source:'runner'}];
  if(!qaSupports(this.confinedExecutor,profile))return blocked('No verified isolated '+profile+' executor. Unrestricted host execution is disabled by Stage 7.');
  if(!files.length||files.some(p=>!existsSync(this.checked(p))))return blocked('No approved existing test files');
  if(!ctx||ctx.agentId!=='qa')return blocked('Owned QA task context required');
  const context={...ctx,...(profile!=='node_tests'?{baselineFiles:webSupportFiles}:{})},paths=[...new Set([...scope,...(profile!=='node_tests'?webSupportFiles:[])])],sources=paths.map(path=>this.permissions.readFile(context,path));
  if(profile!=='node_tests')webSnapshot(files,sources);const evidence=await this.confinedExecutor.run({profile,files,sources,revision,operationId:ctx.operationId,recordContainer:ctx.recordContainer,recordReport:report=>this.reports.put(ctx,report),recordBuild:assets=>new BuildArtifacts(this.root,this.permissions.projectId).put(ctx,revision,assets)});
  const expected=profile!=='node_tests'?webCommands(files,this.webRegistration()):[command];
  if(!Array.isArray(evidence)||evidence.length>expected.length)throw Error('Invalid executor receipt set');
  evidence.forEach(validateTest);if(evidence.some(e=>e.source!=='runner'||e.revision!==revision||!expected.includes(e.command))||new Set(evidence.map(e=>e.command)).size!==evidence.length)throw Error('Foreign, stale or duplicate executor receipt');
  return expected.map(command=>evidence.find(e=>e.command===command)??({command,status:'BLOCKED',exitCode:null,output:'Required check did not return a receipt; it was not retried',revision,source:'runner'}));
 }
}
