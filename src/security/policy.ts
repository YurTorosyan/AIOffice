/** Shared policy data and pure decisions. Filesystem/OS enforcement belongs to the server broker. */
import {safeText} from './redaction.ts';
export const permissionActions = [
 'file.read','file.create','file.modify','file.delete','file.rename','file.move',
 'directory.read','directory.create','directory.modify','directory.delete',
 'git.status','git.diff','git.log','git.branch.create','git.checkout','git.commit','git.push','git.pull','git.merge','git.reset','git.force_push',
 'terminal.safe','terminal.sensitive','terminal.privileged',
 'dependency.install','dependency.remove','dependency.update','dependency.package_script',
 'project.create','project.import','project.open','project.switch','project.archive','project.reactivate','project.refresh','git.fetch','git.clean','git.branch.delete',
 'network.request','network.api','network.download','config.modify','config.environment','config.build','secret.read',
] as const;
export type PermissionAction=typeof permissionActions[number];
export const securityEmployees=['lead','design','frontend','backend','seo','security','qa','review'] as const;
export type SecurityEmployee=typeof securityEmployees[number];
export type Risk='safe'|'sensitive'|'dangerous';
export type Decision='allowed'|'denied'|'approval_required';
export const permissionPolicyVersion='stage7-v6-p0-operation-binding';
export interface CommandSpec { profile:'armgarage_checks'|'web_checks'|'node_tests'|'git_status'|'git_diff'|'git_log'|'npm_script'|'dependency_install'|'dependency_remove'|'dependency_update'; files?:string[]; script?:'test'|'build'|'lint'; packageName?:string; version?:string }
export interface PermissionContext {projectId?:string;workflowId:string;taskId:string;agentId:string;files:string[];baselineFiles?:string[];hosts?:string[];active:boolean;}
export interface ActionRequest {projectId?:string;repository?:Record<string,unknown>;id:string;workflowId:string;taskId:string;agentId:string;action:PermissionAction;resources:string[];reason:string;command?:CommandSpec;}
export interface PolicyDecision {decision:Decision;risk:Risk;reason:string;}
export interface PermissionRecord {operationId?:string;request:ActionRequest;fingerprint:string;policyVersion:string;status:'pending'|'approved'|'rejected'|'expired'|'consumed'|'failed';createdAt:string;expiresAt:string;decidedAt:string|null;usedAt:string|null;decisionBy:'director'|null;}
export interface SecurityEvent {projectId?:string;id:string;type:'action_requested'|'action_allowed'|'action_denied'|'approval_requested'|'approval_approved'|'approval_rejected'|'approval_expired'|'action_executed'|'action_failed';agentId:string;workflowId:string;taskId:string;action:string;resources:string[];risk:Risk;reason:string;timestamp:string;}
export interface PermissionBook {version:1;records:PermissionRecord[];events:SecurityEvent[];}
export const emptyPermissions=():PermissionBook=>({version:1,records:[],events:[]});
export const rolePolicies:Record<SecurityEmployee,{read:string[];write:string[];profiles:CommandSpec['profile'][]}>={
 lead:{read:[''],write:['src/','tests/','docs/'],profiles:['node_tests','git_status','git_diff','git_log','npm_script','dependency_install','dependency_remove','dependency_update']},
 design:{read:['src/','public/','docs/','tests/'],write:['src/ui/','src/components/','src/design/','public/','tests/design/'],profiles:['node_tests','npm_script']},
 frontend:{read:['src/','public/','tests/','docs/'],write:['src/','public/','tests/'],profiles:['node_tests','git_status','git_diff','npm_script','dependency_install','dependency_remove','dependency_update']},
 backend:{read:['src/','server/','tests/','docs/'],write:['src/','server/','tests/'],profiles:['node_tests','git_status','git_diff','npm_script','dependency_install','dependency_remove','dependency_update']},
 seo:{read:['src/','public/','docs/','tests/'],write:['src/seo/','src/pages/','public/','tests/seo/'],profiles:['node_tests','git_diff','npm_script']},
 security:{read:['src/','server/','tests/','docs/'],write:['docs/security/','tests/security/'],profiles:['node_tests','git_status','git_diff','git_log']},
 qa:{read:['src/','server/','public/','tests/','docs/'],write:['tests/','docs/qa/'],profiles:['armgarage_checks','web_checks','node_tests','git_status','git_diff','npm_script']},
 review:{read:['src/','server/','public/','tests/','docs/'],write:['docs/review/'],profiles:['node_tests','git_status','git_diff','git_log']},
};
export const secretResource=(s:string)=>/(?:^|\/)(?:\.env(?:\..*)?|auth\.json|credentials(?:\..*)?|id_rsa|id_ed25519|secrets?)(?:\/|$)|\.(?:key|pem|p12|pfx)$/i.test(s)||/(?:^|\/)(?:\.aws|\.ssh|\.azure|\.kube)(?:\/|$)/i.test(s);
export const protectedWrite=(s:string)=>/^(?:\.git|\.codex|\.agents|\.ai-office|node_modules)(?:\/|$)|^(?:server\/(?!features\/)|src\/(?:security|orchestration|integration|agents|projects)\/)|^src\/ui\/(?:App\.tsx|Office\.tsx|style\.css)$/i.test(s);
export function canonicalResourceSyntax(value:unknown):string {
 if(typeof value!=='string'||!value||value.length>240||value!==value.normalize('NFC')||/[\x00-\x1f\x7f:%\\]/.test(value)||value.startsWith('/')||value.includes('//')||value.split('/').some(s=>!s||s==='.'||s==='..'||/[ .]$/.test(s)||/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(s)))throw new Error('Unsafe resource representation');
 if(!/^[a-zA-Z0-9_.@/-]+$/.test(value))throw new Error('Invalid resource');return value;
}
export function classifyAction(action:PermissionAction):Risk {if(['git.clean','git.branch.delete','secret.read','terminal.privileged','file.delete','directory.delete','directory.modify','git.reset','git.force_push'].includes(action))return 'dangerous';return ['file.read','directory.read','git.status','git.diff','git.log'].includes(action)?'safe':'sensitive';}
export function validateCommand(value:unknown):CommandSpec {
 const c=value as CommandSpec;if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['profile','files','script','packageName','version'].includes(k)))throw new Error('Structured command required');
 if(['armgarage_checks','web_checks','node_tests','git_status','git_diff','git_log'].includes(c.profile)){if(!Array.isArray(c.files)||c.files.length>16||c.files.some(p=>typeof p!=='string'))throw new Error('Exact command files required');c.files.forEach(canonicalResourceSyntax);if(['armgarage_checks','node_tests','web_checks'].includes(c.profile)&&(!c.files.length||c.files.some(p=>!(['armgarage_checks','web_checks'].includes(c.profile)?/^tests\/.+\.test\.(?:tsx|ts|mjs|js)$/:/^tests\/.+\.test\.(?:ts|mjs|js)$/).test(p))))throw new Error('Only scoped Node test files');if(c.script||c.packageName||c.version)throw new Error('Unexpected command arguments');}
 else if(c.profile==='npm_script'){if(!['test','build','lint'].includes(c.script??'')||c.files||c.packageName||c.version)throw new Error('Unknown script profile');}
 else if(['dependency_install','dependency_remove','dependency_update'].includes(c.profile)){if(typeof c.packageName!=='string'||! /^(?:@[a-z0-9_-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(c.packageName)||c.packageName.length>120||c.files||c.script||c.profile!=='dependency_remove'&&(typeof c.version!=='string'||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(c.version)))throw new Error('Exact registry package/version required');}
 else throw new Error('Unknown command profile');return structuredClone(c);
}
export function evaluatePolicy(ctx:PermissionContext,request:ActionRequest):PolicyDecision {
 const risk=classifyAction(request.action),deny=(reason:string):PolicyDecision=>({decision:'denied',risk,reason});
 if(!securityEmployees.includes(ctx.agentId as SecurityEmployee)||!ctx.active||ctx.agentId!==request.agentId||ctx.workflowId!==request.workflowId||ctx.taskId!==request.taskId)return deny('Employee, active task or workflow ownership mismatch');
 if(!permissionActions.includes(request.action)||!request.resources.length||request.resources.length>16)return deny('Unknown action or invalid resources');
 if(ctx.projectId&&request.projectId!==ctx.projectId)return deny('Project ownership mismatch');
 if(request.action.startsWith('project.'))return ctx.agentId==='lead'&&request.resources.length===1&&request.resources[0].startsWith('@project/')?{decision:'allowed',risk:'safe',reason:'Director project metadata operation'}:deny('Project management requires Director context');
 if(['git.reset','git.force_push','git.clean','git.branch.delete'].includes(request.action))return deny('Destructive Git operations are not enabled');
 if(request.action==='secret.read'||request.action==='config.environment'||request.action==='terminal.privileged')return deny('Raw secrets, environment configuration and privileged execution are forbidden');
 const role=rolePolicies[ctx.agentId as SecurityEmployee];
 if(request.action.startsWith('network.')){try{for(const resource of request.resources){const u=new URL(resource);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!ctx.hosts?.includes(u.hostname)||[...u.searchParams.keys()].some(k=>/token|key|secret|password|auth/i.test(k)))return deny('Network resource not explicitly scoped');}}catch{return deny('Invalid network resource');}return {decision:'approval_required',risk,reason:'Temporary exact-resource network approval required'};}
 if(request.action.startsWith('dependency.')||request.action.startsWith('terminal.')){try{const c=validateCommand(request.command);if(!role.profiles.includes(c.profile))return deny('Command profile not allowed for this role');if(c.files?.some(f=>!ctx.files.includes(f)||secretResource(f)))return deny('Command accesses files outside this task');const profiles:Record<string,string>={'dependency.install':'dependency_install','dependency.remove':'dependency_remove','dependency.update':'dependency_update','dependency.package_script':'npm_script'};if(profiles[request.action]&&profiles[request.action]!==c.profile)return deny('Action/profile mismatch');if(request.action==='terminal.safe'&&!['armgarage_checks','web_checks','node_tests','git_status','git_diff','git_log'].includes(c.profile))return deny('Sensitive profile is not a safe command');if(c.files&&JSON.stringify(c.files)!==JSON.stringify(request.resources))return deny('Command resource mismatch');if(c.packageName&&(request.resources.length!==1||request.resources[0]!==c.packageName))return deny('Package resource mismatch');}catch{return deny('Unknown or unstructured command');}return {decision:'approval_required',risk,reason:'One-operation approval required; executable code is never implicitly trusted'};}
 if(request.action.startsWith('git.')){if(!['git.status','git.diff','git.log'].includes(request.action)){if(request.resources.length!==1||request.resources[0]!=='.git'||!ctx.files.includes('.git')||!validGitPlan(request.action,request.repository))return deny('Exact repository operation required');return ctx.agentId==='lead'?{decision:'approval_required',risk,reason:'Exact task-scoped Git mutation requires Director approval'}:deny('Git mutation not allowed for this employee');}}
 const read=['file.read','directory.read','git.status','git.diff','git.log'].includes(request.action);
 for(const resource of request.resources){try{canonicalResourceSyntax(resource);}catch{return deny('Unsafe canonical path');}if(secretResource(resource))return deny('Secret resource is forbidden');
  const baseline=read&&ctx.baselineFiles?.includes(resource),scoped=ctx.files.includes(resource)||['directory.create','directory.read'].includes(request.action)&&ctx.files.some(f=>f.startsWith(resource+'/'));
  if(!baseline&&!scoped)return deny('Resource outside exact task scope');
  const prefixes=read?role.read:role.write;
  const scopedParent=['directory.create','directory.read'].includes(request.action)&&prefixes.some(prefix=>prefix.startsWith(resource+'/')&&ctx.files.some(file=>file.startsWith(prefix)&&file.startsWith(resource+'/')));
  if(!baseline&&!prefixes.some(prefix=>resource.startsWith(prefix))&&!scopedParent)return deny('Resource outside role capabilities');
  if(!read&&(/^(?:\.git|\.codex|\.agents|\.ai-office|node_modules)(?:\/|$)/i.test(resource)||(ctx.projectId??'office-demo')==='office-demo'&&protectedWrite(resource)))return deny('Security control plane is protected');
  if(!read&&ctx.agentId==='backend'&&/^(?:src\/(?:ui|components|frontend|design)\/|public\/)/.test(resource))return deny('Frontend resource is outside backend role');
  if(!read&&ctx.agentId==='frontend'&&/^(?:server\/|src\/(?:backend|api)\/)/.test(resource))return deny('Backend resource is outside frontend role');
 }
 return {decision:read?'allowed':'approval_required',risk,reason:read?'Scoped read allowed':'Exact scoped effect requires expiring Director approval'};
}
export function validGitPlan(action:string,value:unknown):boolean {
 const p=value as {operation:string;branch:string;head:string|null;stateHash:string;paths:string[];message:string;fileHashes:Record<string,string|null>;origin:string|null};if(!p||typeof p!=='object'||Object.keys(p).sort().join(',')!=='branch,fileHashes,head,message,operation,origin,paths,stateHash'||!['fetch','pull','checkout','commit','push'].includes(p.operation)||action!=='git.'+p.operation||typeof p.branch!=='string'||p.branch.length>200||!/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(p.branch)||p.branch.includes('..')||p.branch.includes('//')||p.branch.endsWith('/')||p.branch.split('/').some(s=>s.endsWith('.lock')||s.endsWith('.'))||p.head!==null&&!/^[a-f0-9]{40,64}$/.test(p.head)||!/^[a-f0-9]{64}$/.test(p.stateHash)||!Array.isArray(p.paths)||p.paths.length>64||new Set(p.paths).size!==p.paths.length||typeof p.message!=='string'||p.message.length>200||safeText(p.message)!==p.message||/[\x00-\x1f]/.test(p.message)||!p.fileHashes||typeof p.fileHashes!=='object')return false;
 try{p.paths.forEach(path=>{canonicalResourceSyntax(path);if(secretResource(path))throw new Error();});if(p.operation==='commit'&&(!p.paths.length||!p.message.trim())||p.operation!=='commit'&&(p.paths.length||p.message))return false;if(Object.keys(p.fileHashes).sort().join('|')!==[...p.paths].sort().join('|')||Object.values(p.fileHashes).some(v=>v!==null&&!/^[a-f0-9]{64}$/.test(v)))return false;if(['fetch','pull','push'].includes(p.operation)){const url=new URL(p.origin??'');if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port&&url.port!=='443')return false;}else if(p.origin!==null)return false;return true;}catch{return false;}
}
