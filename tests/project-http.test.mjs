import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {createBridge} from '../server/http.mjs';
import {ProjectManager} from '../server/projects.mjs';
test('project HTTP enforces origin/nonce, exact active-project routing and read-only task queries; no shell endpoint',async()=>{
 mkdirSync('work/project-http',{recursive:true});const root=mkdtempSync(resolve('work/project-http/fixture-')),a=resolve(root,'a'),office=resolve(root,'office');mkdirSync(a);mkdirSync(office);const projects=new ProjectManager(office);await projects.initialize();const bridge=createBridge({root:office,projects,port:0});await bridge.listen();const base=`http://127.0.0.1:${bridge.server.address().port}`,session=await (await fetch(base+'/api/codex/session')).json(),headers={'Content-Type':'application/json','X-AI-Office-Token':session.token};
 try{assert.equal((await fetch(base+'/api/projects/action',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);assert.equal((await fetch(base+'/api/projects/snapshot',{headers:{origin:'https://example.invalid'}})).status,403);
  const created=await fetch(base+'/api/projects/action',{method:'POST',headers,body:JSON.stringify({action:'import',projectId:'a',name:'A',workspaceRoot:a})});assert.equal(created.status,200);
  await projects.runtime.orchestration.engine.create('Scoped fixture request','owned');const tasks=await (await fetch(base+'/api/projects/tasks?projectId=office-demo&agentId=lead&priority=high')).json();assert.equal(tasks.tasks.length,1);assert.equal(tasks.tasks[0].projectId,'office-demo');assert.equal(tasks.tasks[0].workflowId,'owned');assert.equal((await fetch(base+'/api/projects/tasks?projectId=a')).status,409);
  await projects.runtime.orchestration.engine.command('owned','pause');await projects.command({action:'switch',projectId:'a'});assert.equal((await fetch(base+'/api/codex/snapshot?projectId=office-demo')).status,409);assert.equal((await fetch(base+'/api/codex/action',{method:'POST',headers,body:JSON.stringify({action:'connect',agentId:'lead',projectId:'office-demo'})})).status,409);assert.equal((await fetch(base+'/api/projects/tasks?projectId=a')).status,200);assert.equal((await fetch(base+'/api/shell',{method:'POST',headers,body:'{}'})).status,404);
  let release;const lease=projects.withRuntime('a',()=>new Promise(resolve=>{release=resolve;}));await Promise.resolve();await assert.rejects(projects.command({action:'switch',projectId:'office-demo'}),/in progress/);release();await lease;
 }finally{await bridge.close();}
});
