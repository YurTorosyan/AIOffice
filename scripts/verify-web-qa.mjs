/** Explicit local runner validation; no Codex, no host project scripts, no workflow mutation. */
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {WebQAExecutor,webSupportFiles} from '../server/qa-web.mjs';
import {TeamActions} from '../server/team-actions.mjs';
import {PermissionAuthority,MemoryPermissionStorage} from '../server/permissions.mjs';
import {canonicalWorkspace} from '../server/workspace.mjs';
const root=canonicalWorkspace(process.argv[2]??'C:/Projects'),projectId='web-qa-verification',scope=['src/App.tsx','tests/App.test.tsx','src/styles/coffee-house.css','tests/coffee-house-styles.test.ts'];
const permissions=new PermissionAuthority(root,{projectId,storage:new MemoryPermissionStorage()}),actions=new TeamActions(root,{permissions}),executor=new WebQAExecutor();
const status=await executor.verify();if(!status.available)throw Error(status.reason);const revision=actions.verificationRevision(scope),before=actions.revision(scope),sources=[...new Set([...scope,...webSupportFiles])].map(file=>({path:file,text:readFileSync(join(root,file),'utf8')}));
const records=await executor.run({profile:'web_checks',files:scope.filter(p=>p.startsWith('tests/')),sources,revision});if(actions.verificationRevision(scope)!==revision||actions.revision(scope)!==before)throw Error('Inputs changed during isolated checks');
writeFileSync(resolve('work/web-qa-real-proof.json'),JSON.stringify({status,revision,sourceRevision:before,records},null,2)+'\n');for(const r of records)console.log(JSON.stringify(r));if(records.some(r=>r.status!=='PASS'))process.exitCode=1;
