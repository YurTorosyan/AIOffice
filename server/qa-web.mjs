import {diagnosticPreview} from './qa-report-store.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {docker,inspectOwnedContainer,cleanupOwnedContainer} from './qa-executor.mjs';
import {canonicalResourceSyntax,secretResource} from '../src/security/policy.ts';
import {safeText} from '../src/security/redaction.ts';
import {webRegistration} from './qa-web-profiles.mjs';
import packages from './qa-web-image/package.json' with {type:'json'};
export const webSupportFiles=['package.json','package-lock.json','index.html','src/main.tsx','test-support/setup.ts','tsconfig.json','vite.config.ts'];
export const webScope=scope=>scope.some(p=>/\.(tsx|css)$/.test(p));
const sha=s=>createHash('sha256').update(s).digest('hex');
const seccomp=fileURLToPath(new URL('./qa-web-image/seccomp.json',import.meta.url));
export function webContainerArgs(name,mode,registration='coffee-house',operationId){if(operationId!==undefined&&!/^[a-zA-Z0-9_.:-]{1,160}$/.test(operationId))throw Error('Invalid operation ID');
 const image=webRegistration(registration);
 if(!/^ai-office-web-qa-[a-f0-9-]{36}$/.test(name)||!['probe','vitest','build','browser'].includes(mode)||!/^sha256:[a-f0-9]{64}$/.test(image.image))throw Error('Invalid fixed QA image/profile');
 if(sha(readFileSync(seccomp))!=='80fd2aa8207f28065018ec5411cd132947b304300fc1367f4a934e520f70702b')throw Error('Seccomp profile changed');
 // Chromium uses file-backed bitmap buffers for full-page screenshots. 16 MiB
 // terminates it on tall tablet pages even when the compressed PNG is small.
 const fileLimit=registration==='armgarage'&&mode==='browser'?134217728:16777216;
 return ['run','--rm','--pull=never','--name',name,'--label','ai-office.owner=web-qa',...(operationId?['--label','ai-office.operation='+operationId]:[]),'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--security-opt=seccomp='+seccomp,'--user=1000:1000','--pids-limit=256','--memory=1g','--memory-swap=1g','--cpus=2','--ulimit','nofile=1024:1024','--ulimit',`fsize=${fileLimit}:${fileLimit}`,'--tmpfs','/work:rw,nosuid,nodev,size=64m,mode=1777','--tmpfs','/tmp:rw,nosuid,nodev,size=64m,mode=1777','--shm-size=128m','--ipc=private','--workdir=/work','--log-driver=none','--init','-i',image.image,mode];
}
export function webSnapshot(files,sources){
 if(!Array.isArray(files)||!files.length||files.length>16||!Array.isArray(sources)||sources.length>24)throw Error('Invalid web snapshot');const seen=new Set();let size=0;
 for(const s of sources){canonicalResourceSyntax(s.path);if(seen.has(s.path)||secretResource(s.path)||(!webSupportFiles.includes(s.path)&&! /^(src|tests)\/.+\.(ts|tsx|css|js|mjs|json)$/.test(s.path))||typeof s.text!=='string'||safeText(s.text)!==s.text)throw Error('Unsafe web snapshot');seen.add(s.path);size+=Buffer.byteLength(s.text);}
 if(size>400000||files.some(f=>!/^tests\/[a-zA-Z0-9_./-]+\.test\.(ts|tsx|js|mjs)$/.test(f)||!seen.has(f))||webSupportFiles.some(p=>!seen.has(p)))throw Error('Incomplete/oversized web snapshot');
 const manifest=JSON.parse(sources.find(s=>s.path==='package.json').text),registration=webRegistration(manifest.name);
 const declared={...manifest.dependencies,...manifest.devDependencies};for(const [name,version] of Object.entries(declared))if(({...packages.dependencies,...packages.devDependencies})[name]!==version)throw Error('Unregistered dependency version: '+name);
 for(const name of ['react','react-dom','vite','vitest','typescript','jsdom','@testing-library/react','@testing-library/jest-dom'])if(!declared[name])throw Error('Missing profile dependency: '+name);
 return {files,sources:sources.map(({path,text})=>({path,text})),...(registration.name!=='coffee-house'?{registration:registration.name}:{})};
}
export const webVerificationIdentity=(name='coffee-house')=>{const image=webRegistration(name);return JSON.stringify({profile:image.profile,image:image.image,seccomp:sha(readFileSync(seccomp)),support:webSupportFiles});};
export const webCommands=(files,name='coffee-house')=>['vitest run --config [trusted React/jsdom profile] '+files.join(' ')+(name==='armgarage'?' /opt/qa/armgarage-domain.test.mjs':''),'tsc --noEmit [trusted React profile] && vite build [trusted profile]',webRegistration(name).browser];
export class WebQAExecutor {
 constructor({command=docker,registration='coffee-house'}={}){this.registration=registration;this.contract=webRegistration(registration);this.command=command;this.ready=false;this.busy=false;this.reason='Web QA not verified';this.verifiedAt=null;}
 status(){return {available:this.ready,kind:'docker-web-snapshot',profile:this.contract.profile,image:this.contract.image,verifiedAt:this.verifiedAt,reason:this.reason};}
 inspectOwned(identity){if(identity.profile!==this.contract.permission)throw Error('Foreign QA profile');return inspectOwnedContainer(this.command,identity,identity.operationId,this.contract.image);}
 cleanupOwned(identity){if(identity.profile!==this.contract.permission)throw Error('Foreign QA profile');return cleanupOwnedContainer(this.command,identity,identity.operationId,this.contract.image);}
 async execute(mode,input='',{operationId,recordContainer}={}){const name='ai-office-web-qa-'+randomUUID(),identity={name,operationId:operationId??null,kind:'web',image:this.contract.image,profile:this.contract.permission,mode,cleanupConfirmed:false};recordContainer?.(identity);try{return await this.command(webContainerArgs(name,mode,this.registration,operationId),{input:typeof input==='string'?input:JSON.stringify(input),timeoutMs:this.registration==='armgarage'&&(mode==='vitest'||mode==='browser')?200000:90000,maxOutput:mode==='build'?5000000:100000,redact:mode!=='build'});}finally{const c=await this.command(['rm','--force',name]);if(c.code!==0&&!/No such container/i.test(c.output)){this.ready=false;this.reason='Web QA cleanup unconfirmed';throw Error(this.reason);}recordContainer?.({...identity,cleanupConfirmed:true});}}
 async verify(){this.ready=false;try{const info=await this.command(['info','--format','{{json .}}']);if(info.code!==0)throw Error('Local Docker engine unavailable');const j=JSON.parse(info.output);if(j.OSType!=='linux'||!j.MemoryLimit||!j.PidsLimit||!j.SecurityOptions?.some(s=>s.includes('seccomp')))throw Error('Required Linux isolation unavailable');const inspected=await this.command(['image','inspect',this.contract.image,'--format','{{json .}}']);if(inspected.code!==0||JSON.parse(inspected.output).Id!==this.contract.image)throw Error('Pinned web QA image unavailable');const probe=await this.execute('probe');if(probe.code!==0||probe.timedOut||probe.limited)throw Error('Web isolation/browser probe failed: '+probe.output.slice(-700));this.ready=true;this.reason=null;this.verifiedAt=new Date().toISOString();}catch(e){this.reason=e.message;}return this.status();}
 async run({profile,files,sources,revision,operationId,recordContainer,recordReport}){
  const commands=webCommands(files,this.registration),records=[],runId=randomUUID(),record=(i,status,code,output,capture)=>{const full=safeText(`run=${runId}; image=${this.contract.image}; input=${revision}\n`+output),report=capture&&recordReport?recordReport({mode:['vitest','build','browser'][i],command:commands[i],status,exitCode:code,revision,output:full,complete:!capture.limited&&!capture.timedOut&&capture.code!==null}):null;return {command:commands[i],status,exitCode:code,output:diagnosticPreview(full),revision,source:'runner',...(report?{report}:{})};};
  if(!this.ready||this.busy||profile!==this.contract.permission)return commands.map((_,i)=>record(i,'BLOCKED',null,'Verified web QA unavailable or busy'));
  this.busy=true;try{const input=webSnapshot(files,sources);if((input.registration??'coffee-house')!==this.registration)throw Error('QA profile/project mismatch');let assets=null;
   for(const [i,mode] of ['vitest','build','browser'].entries()){
    if(mode==='browser'&&!assets){records.push(record(i,'BLOCKED',null,'No successful production build; browser did not run'));continue;}
    const r=await this.execute(mode,mode==='browser'?{assets}:input,{operationId,recordContainer});if(r.code===null||[125,126,127].includes(r.code)||(this.registration==='armgarage'&&r.code>=128)||r.timedOut||r.limited){records.push(record(i,'BLOCKED',null,(r.timedOut?'Isolated timeout\n':r.limited?'Output limit\n':'')+r.output,r));continue;}
    let output=r.output;if(mode==='build'&&r.code===0){const b=JSON.parse(r.output);if(!Array.isArray(b.assets)||!b.assets.length||b.assets.length>64)throw Error('Invalid production assets');let bytes=0;for(const a of b.assets){canonicalResourceSyntax(a.path);if(!/\.(html|js|css|svg)$/.test(a.path)||typeof a.text!=='string')throw Error('Unexpected artifact type');bytes+=Buffer.byteLength(a.text);}if(bytes>4000000||!b.assets.some(a=>a.path==='index.html'))throw Error('Invalid build size/index');assets=b.assets;output=b.output+'\nbuild assets sha256='+sha(JSON.stringify(assets));}
    records.push(record(i,r.code===0?'PASS':'FAIL',r.code,output,r));
   }return records;
  }catch(e){for(let i=records.length;i<3;i++)records.push(record(i,'BLOCKED',null,'Web verification failed closed: '+e.message));return records;}finally{this.busy=false;}
 }
}
