import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {TeamActions} from '../server/team-actions.mjs';

// Kill a separate writer without finally/catch. No models, Docker, live state or host commands from agents.
test('seeded process-death matrix recovers only uncommitted effects and never rewrites confirmed bytes',async()=>{
 const base=resolve('work/p0-validation/crashes');mkdirSync(base,{recursive:true});
 const evidence=[];
 for(let seed=1;seed<=10;seed++)for(const phase of ['intent_saved','grants_consumed','before_effect','file_replaced','resource_recorded','before_receipt','after_receipt']){
  const root=mkdtempSync(resolve(base,'case-'));mkdirSync(resolve(root,'src'));
  const actions=new TeamActions(root),w={id:'crash-flow',projectId:'office-demo',status:'paused'},
   t={id:'ui',projectId:'office-demo',agentId:'frontend',status:'paused',teamSpec:{scope:['src/one.ts','src/two.ts','src/three.ts']}},
   a={id:'crash-approval',taskId:t.id,employeeId:t.agentId,action:'apply_changes',status:'pending',patches:t.teamSpec.scope.map((path,i)=>({path,before:null,content:'export const n = '+(seed+i)+';\n'})),previous:Object.fromEntries(t.teamSpec.scope.map(p=>[p,null])),commands:[]};
  a.security=actions.prepare(w,t,a);writeFileSync(resolve(root,'fixture.json'),JSON.stringify({w,t,a}));
  const child=spawnSync(process.execPath,['--experimental-strip-types',resolve('tests/fixtures/p0-worker.mjs'),root,phase],{encoding:'utf8',timeout:20000,windowsHide:true});
  assert.equal(child.status,73,phase+': '+child.stderr);
  const restored=new TeamActions(root),plan=restored.prepareRecovery(w,t,a),observed=new Map(plan.resources.filter(r=>r.observation==='after').map(r=>[r.path,lstatSync(resolve(root,r.path)).mtimeMs]));
  let receipt;
  if(plan.state==='completed')receipt=await restored.approve(w,t,a);
  else if(plan.state==='metadata_only')receipt=restored.reconcileMetadata(w,t,a,plan);
  else{
   assert.equal(plan.state,'remaining_approval');
   const next={...structuredClone(a),id:'fresh-approval',security:undefined,recovery:{operationId:plan.operationId,planHash:plan.planHash,completedPaths:[...observed.keys()]}};
   next.security=restored.prepare(w,t,next);assert.equal(next.security.decision,'approval_required');
   receipt=await restored.approve(w,t,next);
  }
  assert.deepEqual(receipt.filesChanged,t.teamSpec.scope);
  for(const p of a.patches){assert.equal(readFileSync(resolve(root,p.path),'utf8'),p.content);if(observed.has(p.path))assert.equal(lstatSync(resolve(root,p.path)).mtimeMs,observed.get(p.path));}
  assert.equal(restored.operations.get(a.id).state,'completed');
  evidence.push({seed,phase,observedPaths:[...observed.keys()],recovery:plan.state,receipt});
 }
 writeFileSync(resolve(base,'matrix-'+(process.env.AI_OFFICE_MAX_ACTIVE??'default')+'.json'),JSON.stringify({version:1,cases:evidence.length,evidence},null,2));
 assert.equal(evidence.length,70);
});
