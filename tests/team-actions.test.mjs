import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,lstatSync,symlinkSync,rmdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {TeamActions} from '../server/team-actions.mjs';
import {RealExecutionPort} from '../server/orchestration.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(){const base=resolve('work/team-actions-tests');mkdirSync(base,{recursive:true});const root=mkdtempSync(resolve(base,'project-'));mkdirSync(resolve(root,'src'));mkdirSync(resolve(root,'tests'));return {root,actions:new TeamActions(root)};}
function request(path,content,before=null,id='approval-one'){return {w:{id:'flow'},t:{id:'implement',agentId:'backend',teamSpec:{scope:[path]}},a:{id,taskId:'implement',employeeId:'backend',action:'apply_changes',status:'pending',patches:[{path,content,before}],previous:{[path]:null},commands:[]}};}

test('a new project creates missing src/tests parents only after exact approval and retains all proposed bytes',async()=>{
 const base=resolve('work/team-actions-tests');mkdirSync(base,{recursive:true});const root=mkdtempSync(resolve(base,'empty-')),actions=new TeamActions(root);
 const paths=['src/App.tsx','src/styles/coffee.css','tests/App.test.tsx','tests/style.test.ts'],r=request(paths[0],'static frontend');r.t.agentId='frontend';r.a.employeeId='frontend';r.t.teamSpec.scope=paths;r.a.patches=paths.map((path,i)=>({path,content:'approved '+i,before:null}));r.a.previous=Object.fromEntries(paths.map(p=>[p,null]));
 r.a.security=actions.prepare(r.w,r.t,r.a);assert.equal(r.a.security.decision,'approval_required');assert.throws(()=>readFileSync(resolve(root,paths[0])));
 const receipt=await actions.approve(r.w,r.t,r.a);assert.deepEqual(receipt.filesChanged,paths);for(const [i,path] of paths.entries())assert.equal(readFileSync(resolve(root,path),'utf8'),'approved '+i);
});
test('exact approved patch writes real source, is idempotent and refuses stale original hashes',async()=>{const f=fixture(),r=request('src/helper.ts','export const value = 1;\n');r.a.security=f.actions.prepare(r.w,r.t,r.a);const receipt=await f.actions.approve(r.w,r.t,r.a);assert.deepEqual(receipt.filesChanged,['src/helper.ts']);assert.equal(readFileSync(resolve(f.root,'src/helper.ts'),'utf8'),r.a.patches[0].content);assert.deepEqual(await f.actions.approve(r.w,r.t,r.a),receipt);const stale=request('src/helper.ts','overwritten',null,'approval-two');stale.a.security=f.actions.prepare(stale.w,stale.t,stale.a);await assert.rejects(f.actions.approve(stale.w,stale.t,stale.a),/Stale/);assert.equal(readFileSync(resolve(f.root,'src/helper.ts'),'utf8'),r.a.patches[0].content);});
test('changed approval contents, missing confirmation, secrets and escaping paths never write',async()=>{const f=fixture();for(const path of ['../escape.ts','src/../escape.ts','src/orchestration/model.ts','.env']){const r=request(path,'unsafe');await assert.rejects(f.actions.approve(r.w,r.t,r.a));}const r=request('src/value.ts','password=unacceptable');r.a.security=f.actions.prepare(r.w,r.t,r.a);await assert.rejects(f.actions.approve(r.w,r.t,r.a),/sensitive/);const denied=request('src/value.ts','safe');denied.a.status='rejected';await assert.rejects(f.actions.approve(denied.w,denied.t,denied.a));});
test('unconfined Node code is blocked, including after a request for Director approval',async()=>{const f=fixture();writeFileSync(resolve(f.root,'tests/check.test.mjs'),"throw new Error('must not execute');");const scope=['tests/check.test.mjs'],e=await f.actions.runTests(scope,f.actions.revision(scope));assert.equal(e[0].status,'BLOCKED');assert.match(e[0].output,/isolated/);const w={id:'flow'},t={id:'qa',agentId:'qa',teamSpec:{scope}},a={id:'run-one',taskId:'qa',employeeId:'qa',status:'pending',action:'run_tests',patches:[],commands:[]};a.security=f.actions.prepare(w,t,a);assert.equal(a.security.decision,'denied');await assert.rejects(f.actions.approve(w,t,a),/confined/);});
test('source preview binds the actual before text and hash, and snapshots represent missing new files honestly',()=>{const f=fixture();writeFileSync(resolve(f.root,'src/value.ts'),'old');const r=request('src/value.ts','new',sha('old'));r.t.result={team:{patches:r.a.patches}};assert.deepEqual(f.actions.preview(r.t),{'src/value.ts':'old'});writeFileSync(resolve(f.root,'src/value.ts'),'externally changed');assert.throws(()=>f.actions.preview(r.t),/Stale/);assert.match(f.actions.snapshots(['src/new.ts'],{workflowId:'flow',taskId:'implement',agentId:'backend',files:['src/new.ts'],active:true})[0].text,/DOES NOT EXIST/);});
test('a file changed during a model gate invalidates the result instead of accepting stale QA',()=>{const f=fixture();writeFileSync(resolve(f.root,'src/value.ts'),'before');const scope=['src/value.ts'],revision=f.actions.verificationRevision(scope),port=new RealExecutionPort({maxActive:2},f.actions),task={teamSpec:{scope,testEvidence:[{source:'runner',revision}]}};port.validateResult(task);writeFileSync(resolve(f.root,'src/value.ts'),'after');assert.throws(()=>port.validateResult(task),/stale/);});

test('two prepared proposals sharing a parent can be confirmed sequentially across a restart without replay',async()=>{
 const f=fixture(),one=request('src/components/First.tsx','first',null,'shared-first'),two=request('src/components/Second.tsx','second',null,'shared-second');
 for(const r of [one,two]){r.t.agentId=r.a.employeeId='frontend';r.a.security=f.actions.prepare(r.w,r.t,r.a);}
 const original=structuredClone(two.a),first=await f.actions.approve(one.w,one.t,one.a),stamp=lstatSync(resolve(f.root,one.a.patches[0].path)).mtimeMs;
 const restored=new TeamActions(f.root),prepared=restored.requests(two.w,two.t,two.a,true);assert.deepEqual(prepared.requests.map(r=>r.id),two.a.security.requestIds);
 const second=await restored.approve(two.w,two.t,two.a);assert.deepEqual(two.a,original);assert.deepEqual(second.filesChanged,['src/components/Second.tsx']);assert.equal(readFileSync(resolve(f.root,'src/components/Second.tsx'),'utf8'),'second');assert.equal(readFileSync(resolve(f.root,'src/components/First.tsx'),'utf8'),'first');assert.equal(lstatSync(resolve(f.root,'src/components/First.tsx')).mtimeMs,stamp);assert.deepEqual(await restored.approve(one.w,one.t,one.a),first);assert.equal(lstatSync(resolve(f.root,'src/components/First.tsx')).mtimeMs,stamp);
});
test('nested shared directories retain original operation order and independent file digests',async()=>{
 const f=fixture(),r=request('src/components/nested/One.tsx','one');r.t.agentId=r.a.employeeId='frontend';r.t.teamSpec.scope=['src/components/nested/One.tsx','tests/nested/One.test.tsx'];r.a.patches=r.t.teamSpec.scope.map(path=>({path,before:null,content:path}));r.a.previous=Object.fromEntries(r.t.teamSpec.scope.map(p=>[p,null]));r.a.security=f.actions.prepare(r.w,r.t,r.a);
 mkdirSync(resolve(f.root,'src/components/nested'),{recursive:true});mkdirSync(resolve(f.root,'tests/nested'),{recursive:true});assert.deepEqual(f.actions.requests(r.w,r.t,r.a,true).requests.map(r=>r.id),r.a.security.requestIds);await f.actions.approve(r.w,r.t,r.a);for(const p of r.a.patches)assert.equal(readFileSync(resolve(f.root,p.path),'utf8'),p.content);
});
test('shared-parent handling cannot approve a changed diff, path or a parent replaced by a file/junction',async()=>{
 for(const change of ['content','path','file','junction']){
  const f=fixture(),r=request('src/shared/value.ts','original',null,'bound-'+change);r.a.security=f.actions.prepare(r.w,r.t,r.a);
  if(change==='content')r.a.patches[0].content='changed';if(change==='path'){r.a.patches[0].path='src/shared/other.ts';r.t.teamSpec.scope=['src/shared/other.ts'];}if(change==='file')writeFileSync(resolve(f.root,'src/shared'),'not a directory');if(change==='junction'){mkdirSync(resolve(f.root,'src/other'));symlinkSync(resolve(f.root,'src/other'),resolve(f.root,'src/shared'),process.platform==='win32'?'junction':'dir');}
  await assert.rejects(f.actions.approve(r.w,r.t,r.a));assert.throws(()=>readFileSync(resolve(f.root,'src/shared/value.ts')));
 }
});
test('an existing unapproved parent disappearing still requires a new exact approval',async()=>{
 const f=fixture(),r=request('src/shared/value.ts','value');mkdirSync(resolve(f.root,'src/shared'));r.a.security=f.actions.prepare(r.w,r.t,r.a);const parent=resolve(f.root,'src/shared');assert(parent.startsWith(f.root));rmdirSync(parent);await assert.rejects(f.actions.approve(r.w,r.t,r.a),/resources changed/);assert.throws(()=>readFileSync(resolve(f.root,'src/shared/value.ts')));
});
test('rejecting after a shared parent appears closes all original pending operations',()=>{
 const f=fixture(),r=request('src/shared/value.ts','value');r.a.security=f.actions.prepare(r.w,r.t,r.a);mkdirSync(resolve(f.root,'src/shared'));f.actions.reject(r.w,r.t,r.a);assert(f.actions.permissions.snapshot().records.filter(row=>r.a.security.requestIds.includes(row.request.id)).every(row=>row.status==='rejected'));
});

test('Node verification also becomes stale when configuration changes, independent of source hashes',()=>{const f=fixture(),scope=['src/value.ts'];writeFileSync(resolve(f.root,scope[0]),'stable source');const source=f.actions.revision(scope),before=f.actions.verificationRevision(scope);writeFileSync(resolve(f.root,'package.json'),JSON.stringify({name:'fixture',type:'module'}));assert.equal(f.actions.revision(scope),source);assert.notEqual(f.actions.verificationRevision(scope),before);});
