// One explicit, checkpointed Director relocation. Applied only while startup holds the writer lock.
import {existsSync,readFileSync,writeFileSync,mkdirSync,lstatSync,readdirSync,renameSync,copyFileSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {canonicalWorkspace,workspaceIdentity,within} from './workspace.mjs';
import {WorkspaceBoundary} from './permissions.mjs';
import {replaceFile} from './atomic-replace.mjs';
import {validateProjects} from './project-store.mjs';
import {validateWorkflowBook} from '../src/orchestration/model.ts';
import {validateBook} from '../src/checkpoints/model.ts';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const allowed=['.gitignore','package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','src','tests','test-support','node_modules','.ai-office','dist'];
const read=file=>JSON.parse(readFileSync(file,'utf8'));
function save(file,value){const temp=file+'.relocation.tmp';if(existsSync(temp)&&lstatSync(temp).isSymbolicLink())throw Error('Unsafe relocation temp');writeFileSync(temp,JSON.stringify(value));replaceFile(temp,file);}
function inventory(root,name){const full=new WorkspaceBoundary(root).path(name).absolute,stat=lstatSync(full);if(stat.isSymbolicLink())throw Error('Relocation cannot traverse symlinks');if(name==='node_modules')return {directoryIdentity:workspaceIdentity(full)};const files={};const walk=(at,rel)=>{const s=lstatSync(at);if(s.isSymbolicLink())throw Error('Symlink in relocated source');if(s.isDirectory())for(const item of readdirSync(at))walk(join(at,item),rel+'/'+item);else files[rel]=hash(readFileSync(at));};walk(full,name);return {files};}
export function prepareProjectRelocation(root,projectId,target){
 root=canonicalWorkspace(root);const book=validateProjects(read(resolve(root,'.ai-office/projects.json'))),p=book.projects.find(p=>p.id===projectId);if(!p||projectId==='office-demo')throw Error('Only an explicit external project may relocate');const source=canonicalWorkspace(p.workspaceRoot);target=canonicalWorkspace(target);
 if(source===target||!within(source,target)||relative(source,target).split(/[\\/]/).length!==1)throw Error('This migration supports only the explicitly selected child workspace');
 if(book.projects.some(other=>other.id!==projectId&&(within(other.workspaceRoot,target)||within(target,other.workspaceRoot))))throw Error('Target overlaps another registered project');
 const state=resolve(root,'.ai-office/projects',projectId,'.ai-office'),workflows=validateWorkflowBook(read(join(state,'workflows.json')),'codex');if(workflows.workflows.some(w=>!['paused','completed','cancelled'].includes(w.status)||w.tasks.some(t=>['running','launching'].includes(t.status))))throw Error('Pause every workflow before relocation');
 const items=allowed.filter(name=>existsSync(join(source,name))).map(name=>{if(existsSync(join(target,name)))throw Error('Target collision: '+name);return {name,inventory:inventory(source,name)};});if(!items.some(x=>x.name==='package.json')||!items.some(x=>x.name==='src'))throw Error('Project files missing');
 const plan={version:1,id:randomUUID(),status:'pending',projectId,source,target,sourceIdentity:workspaceIdentity(source),targetIdentity:workspaceIdentity(target),items,completed:[],createdAt:new Date().toISOString()};
 const file=resolve(root,'.ai-office/pending-project-relocation.json');if(existsSync(file)&&read(file).status!=='completed')throw Error('Another relocation is pending');save(file,plan);return plan;
}
export function applyPendingProjectRelocation(root){
 const boundary=new WorkspaceBoundary(root),file=boundary.path('.ai-office/pending-project-relocation.json').absolute;if(!existsSync(file))return null;const plan=read(file);if(plan.status==='completed')return plan;if(plan.version!==1||!['pending','moving','metadata'].includes(plan.status)||!Array.isArray(plan.items)||!plan.items.length||plan.items.some(i=>!allowed.includes(i.name))||new Set(plan.items.map(i=>i.name)).size!==plan.items.length)throw Error('Invalid relocation plan');
 const lock=read(boundary.path('.ai-office/bridge.lock').absolute);if(lock.pid!==process.pid)throw Error('Relocation requires the exclusive startup writer lock');
 const source=canonicalWorkspace(plan.source),target=canonicalWorkspace(plan.target);if(!within(source,target)||relative(source,target).split(/[\\/]/).length!==1||workspaceIdentity(source)!==plan.sourceIdentity||workspaceIdentity(target)!==plan.targetIdentity)throw Error('Relocation workspace identity changed');
 const projectFile=boundary.path('.ai-office/projects.json').absolute,book=validateProjects(read(projectFile)),p=book.projects.find(p=>p.id===plan.projectId);if(!p||![source,target].includes(p.workspaceRoot))throw Error('Relocation project changed');
 const state=boundary.path('.ai-office/projects/'+plan.projectId+'/.ai-office').absolute,backup=join(state,'relocation-'+plan.id);mkdirSync(backup,{recursive:true});
 for(const [name,path] of [['projects.json',projectFile],...['workflows.json','recovery.json','permissions.json'].map(n=>[n,join(state,n)])])if(existsSync(path)&&!existsSync(join(backup,name)))copyFileSync(path,join(backup,name));
 // Check all items before the first move; resumes reconcile a completed rename before its journal write.
 for(const item of plan.items){const from=join(source,item.name),to=join(target,item.name);if(existsSync(from)&&existsSync(to))throw Error('Target collision: '+item.name);const at=existsSync(from)?source:target;if(JSON.stringify(inventory(at,item.name))!==JSON.stringify(item.inventory))throw Error('Relocated bytes changed: '+item.name);}
 plan.status='moving';save(file,plan);
 for(const item of plan.items){const from=new WorkspaceBoundary(source).path(item.name).absolute,to=new WorkspaceBoundary(target).path(item.name).absolute;if(existsSync(from))renameSync(from,to);if(!plan.completed.includes(item.name))plan.completed.push(item.name);save(file,plan);}
 plan.status='metadata';save(file,plan);
 const rewrite=value=>{if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){if((key==='workspaceRoot'||key==='localPath')&&v===source)value[key]=target;else if(key==='workspaceIdentity'&&v===plan.sourceIdentity)value[key]=plan.targetIdentity;else if(v&&typeof v==='object')rewrite(v);}};
 for(const name of ['workflows.json','recovery.json']){const path=join(state,name);if(!existsSync(path))continue;const data=read(path);rewrite(data);if(name==='workflows.json')validateWorkflowBook(data,'codex');else validateBook(data,'codex');save(path,data);}
 const permissionFile=join(state,'permissions.json');if(existsSync(permissionFile)){const data=read(permissionFile);for(const record of data.records)if(['pending','approved'].includes(record.status))record.status='expired';save(permissionFile,data);}
 p.workspaceRoot=target;p.workspaceIdentity=plan.targetIdentity;p.repository.localPath=target;p.updatedAt=new Date().toISOString();book.events.push({id:randomUUID(),projectId:p.id,type:'project.relocated',message:'Director relocated exact project files; completed results and original state backup retained',timestamp:p.updatedAt});save(projectFile,validateProjects(book));
 plan.status='completed';plan.completedAt=new Date().toISOString();save(file,plan);return plan;
}
