import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,lstatSync,mkdirSync,realpathSync,renameSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {projectPath} from '../src/orchestration/team-workflow.ts';
import {identifier} from '../src/orchestration/model.ts';
import {safeText} from '../src/checkpoints/model.ts';
const sha=s=>createHash('sha256').update(s).digest('hex');
/** No shell or agent-provided command strings. File effects require a durable, exact Director approval. */
export class TeamActions {
 constructor(root,{run}={}){this.root=realpathSync(root);this.run=run??this.runTests.bind(this);this.dir=resolve(this.root,'.ai-office/team-actions');}
 checked(path){projectPath(path);const full=resolve(this.root,path);let at=this.root;for(const part of relative(this.root,full).split(/[\\/]/)){at=resolve(at,part);if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw new Error('Symlink in project path');}if(relative(this.root,full).startsWith('..'))throw new Error('Escaping project path');return full;}
 journal(id){identifier(id);let at=this.root;for(const p of ['.ai-office','team-actions']){at=resolve(at,p);if(existsSync(at)&&lstatSync(at).isSymbolicLink())throw new Error('Unsafe action journal');}mkdirSync(this.dir,{recursive:true,mode:0o700});const file=resolve(this.dir,id+'.json');if(existsSync(file)&&lstatSync(file).isSymbolicLink())throw new Error('Unsafe receipt');return file;}
 revision(scope){return sha(JSON.stringify([...new Set(scope)].sort().map(path=>{const file=this.checked(path);return [path,existsSync(file)?sha(readFileSync(file)):null];})));}
 snapshots(scope){return [...new Set(scope)].map(path=>{const f=this.checked(path);if(!existsSync(f))return {path,sha256:'0'.repeat(64),text:'FILE DOES NOT EXIST. A new-file proposal must use before=null.'};const bytes=readFileSync(f);if(bytes.length>24000)throw new Error('Scoped snapshot too large');const text=bytes.toString('utf8');if(safeText(text)!==text)throw new Error('Sensitive source is not transferable');return {path,sha256:sha(bytes),text};});}
 preview(t){return Object.fromEntries(t.result.team.patches.map(p=>{const f=this.checked(p.path);const text=existsSync(f)?readFileSync(f,'utf8'):null;if(text!==null&&safeText(text)!==text)throw new Error('Sensitive original file');if((text===null?null:sha(text))!==p.before)throw new Error('Stale proposal before approval');return [p.path,text];}));}
 async approve(w,t,a){if(a.status!=='pending'||a.taskId!==t.id||a.employeeId!==t.agentId)throw new Error('Invalid action owner');const file=this.journal(a.id);let j=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;const fingerprint=sha(JSON.stringify({workflow:w.id,task:t.id,action:a.action,patches:a.patches,previous:a.previous,commands:a.commands,scope:t.teamSpec.scope}));if(j&&j.fingerprint!==fingerprint)throw new Error('Approval payload changed');if(j?.status==='completed'){if(this.revision(t.teamSpec.scope)!==j.receipt.revision)throw new Error('Completed receipt is stale');return j.receipt;}
  const save=()=>{const temp=file+'.tmp';if(existsSync(temp)&&lstatSync(temp).isSymbolicLink())throw new Error('Unsafe journal temp');writeFileSync(temp,JSON.stringify(j),{mode:0o600});renameSync(temp,file);};
  if(a.action==='apply_changes'){
   for(const p of a.patches){if(typeof p.content!=='string'||p.content.length>12000||safeText(p.content)!==p.content)throw new Error('Invalid or sensitive patch');if(!t.teamSpec.scope.includes(p.path))throw new Error('Unapproved scope');const f=this.checked(p.path),current=existsSync(f)?sha(readFileSync(f)):null,after=sha(p.content);if(current!==p.before&&!(j&&current===after))throw new Error('Stale file; request a new proposal');}
   j??={fingerprint,status:'applying',completed:[]};save();
   for(const p of a.patches){const f=this.checked(p.path),current=existsSync(f)?sha(readFileSync(f)):null;if(current!==p.before&&current!==sha(p.content))throw new Error('File changed during application');if(current!==sha(p.content)){mkdirSync(dirname(f),{recursive:true});this.checked(p.path);const temp=f+'.ai-office-'+a.id+'.tmp';if(existsSync(temp))throw new Error('Unconfirmed temporary file; inspect before retry');writeFileSync(temp,p.content,{flag:'wx',mode:0o600});renameSync(temp,f);}if(!j.completed.includes(p.path))j.completed.push(p.path);save();}
   j.receipt={filesChanged:a.patches.map(p=>p.path),tests:[],revision:this.revision(t.teamSpec.scope)};
  }else if(a.action==='run_tests'){
   // A crashed test is not replayed silently: a new approval is required after Director inspection.
   if(j?.status==='testing')throw new Error('Interrupted approved test; Director must inspect it before a new request');
   j={fingerprint,status:'testing'};save();const revision=this.revision(t.teamSpec.scope);const tests=await this.run(t.teamSpec.scope,revision);if(t.teamSpec.scope.some(p=>/\.(?:tsx|css)$/.test(p))||/browser|браузер/i.test(w.rootTask)){tests.push({command:'Browser acceptance verification',status:'BLOCKED',exitCode:null,output:'Browser acceptance requires actual browser evidence; Node tests cannot establish a UI PASS. No automated browser executor is configured.',revision,source:'runner'});}if(this.revision(t.teamSpec.scope)!==revision)throw new Error('Files changed during tests');j.receipt={filesChanged:[],tests,revision};
  }else throw new Error('Unknown approval action');
  j.status='completed';save();return j.receipt;
 }
 async runTests(scope,revision){const files=scope.filter(path=>/^tests\/[a-zA-Z0-9_./-]+\.test\.(?:ts|mjs|js)$/.test(path));const command='node --experimental-strip-types --test '+files.join(' ');
  if(!files.length||files.some(p=>!existsSync(this.checked(p))))return [{command,status:'BLOCKED',exitCode:null,output:'No approved existing Node test files. Browser-only acceptance also requires real browser evidence.',revision,source:'runner'}];
  return new Promise(resolvePromise=>{const env={};for(const key of ['SystemRoot','WINDIR','TEMP','TMP','PATH','PATHEXT'])if(process.env[key])env[key]=process.env[key];const child=spawn(process.execPath,['--experimental-strip-types','--test',...files],{cwd:this.root,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',timedOut=false;const append=b=>{output=(output+b.toString('utf8')).slice(-12000);};child.stdout.on('data',append);child.stderr.on('data',append);const timer=setTimeout(()=>{timedOut=true;child.kill();},30000);child.on('error',()=>{clearTimeout(timer);resolvePromise([{command,status:'BLOCKED',exitCode:null,output:'Approved Node test process could not start',revision,source:'runner'}]);});child.on('close',code=>{clearTimeout(timer);resolvePromise([{command,status:timedOut?'BLOCKED':code===0?'PASS':'FAIL',exitCode:code,output:safeText((timedOut?'Test timeout. ':'')+output).slice(-5000),revision,source:'runner'}]);});});
 }
}
