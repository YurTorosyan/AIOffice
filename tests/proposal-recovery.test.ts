import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {repairProposalFormatting,reduceIndentation} from '../server/proposal-format.mjs';
import {ResultArchive} from '../server/result-archive.mjs';
import {collectTeamResult} from '../src/orchestration/team-workflow.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {validateWorkflowBook} from '../src/orchestration/model.ts';
function content(size:number){const prefix='export function value(){\n'+Array.from({length:100},(_,i)=>'  const v'+i+' = '+i+';\n').join('')+'  return v0;\n}\n/*',suffix='*/\n';return prefix+'x'.repeat(size-prefix.length-suffix.length)+suffix;}
async function fixture(){
 const base=resolve('work/proposal-recovery-tests');mkdirSync(base,{recursive:true});const root=mkdtempSync(resolve(base,'case-')),archive=new ResultArchive(root,'office-demo',root),adapter=new MockCodexAdapter(),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage(),original=port.teamResult.bind(port);port.scenario='team-basic';port.teamResult=t=>{const r=original(t) as any;if(t.id==='plan')r.tasks[0].scope.push('src/extra.ts');if(t.id==='api')r.team.patches=t.teamSpec!.scope.map((path,i)=>({path,before:null,content:content(i===2?8053:8000)}));return r;};
 port.archiveResult=(t,text)=>archive.put(t,text);port.repairProposal=async t=>repairProposalFormatting(t,archive.get(t).response);await adapter.action('connect_all');const engine=new Orchestrator(port,storage);await engine.create('Implement scoped helper','proposal',{team:true});await engine.tick();for(let i=0;i<2;i++){await port.advance(engine.snapshot().workflows[0].tasks);await engine.tick();}return {archive,adapter,port,storage,engine,w:()=>engine.snapshot().workflows[0]};
}
test('oversized full response is archived before rejection and formatting prepares one exact approval without execution or application',async()=>{
 const f=await fixture();try{const before=f.w(),t=before.tasks.find(t=>t.id==='api')!,jobs=f.adapter.getTasks().length;assert.match(t.error!.message,/24053 > 24000/);const raw=f.archive.get(t).response;assert(raw.length>24000);await f.engine.command('proposal','repair_proposal','api');const w=f.w(),after=w.tasks.find(t=>t.id==='api')!;assert.equal(w.status,'paused');assert.equal(after.status,'paused');assert.equal(after.executionId,t.executionId);assert.equal(after.attempts,1);assert.equal(after.proposalRecovery!.originalResponse,raw);assert(after.proposalRecovery!.removedCharacters>=53);assert(after.result!.team!.patches.reduce((n,p)=>n+p.content.length,0)<=24000);assert.equal(w.team!.approvals.filter(a=>a.status==='pending').length,1);assert.deepEqual(after.result!.filesChanged,[]);assert.equal(f.adapter.getTasks().length,jobs);assert.equal(f.archive.get(after).response,raw);validateWorkflowBook(f.storage.book,'mock');assert.equal(new Orchestrator(f.port,f.storage).recoveryError,null);await assert.rejects(f.engine.command('proposal','repair_proposal','api'));
 }finally{f.adapter.stop();}
});
test('strings, JSX text, templates, regex, comments and line breaks survive indentation reduction',async()=>{
 const text='// retained\nexport function App(){\n  const s = `first\n    literal indent`;\n  const r = /a b/;\n  // keep this comment\n  return <main>\n    meaningful JSX text\n    <span title="a  b">{s}</span>\n  </main>;\n}\n';const fixed=await reduceIndentation('App.tsx',text);assert(fixed.length<text.length);assert(fixed.includes('first\n    literal indent'));assert(fixed.includes('\n    meaningful JSX text\n    '));assert(fixed.includes('// keep this comment'));assert(fixed.includes('/a b/'));assert(fixed.includes('title="a  b"'));assert.equal(fixed.replace(/[ \t]/g,''),text.replace(/[ \t]/g,''));assert.equal(fixed.split('\n').length,text.split('\n').length);
});
test('duplicates, foreign paths, oversize single files, invalid syntax and insufficient whitespace are never repaired',async()=>{
 const f=await fixture();try{const t=f.w().tasks.find(t=>t.id==='api')!,raw=JSON.parse(f.archive.get(t).response);for(const mutate of [
  (r:any)=>r.team.patches[1].path=r.team.patches[0].path,
  (r:any)=>r.team.patches[0].path='src/foreign.ts',
  (r:any)=>r.team.patches[0].content=content(12001),
  (r:any)=>r.team.patches.forEach((p:any)=>p.content='x'.repeat(8100)),
 ]){const r=structuredClone(raw);mutate(r);await assert.rejects(repairProposalFormatting(t,JSON.stringify(r)));}
 await assert.rejects(reduceIndentation('bad.ts','export function ( {'));
 }finally{f.adapter.stop();}
});
test('archive rejects foreign identities and altered output; proposal metadata cannot change unrelated data',async()=>{
 const f=await fixture();try{const t=f.w().tasks.find(t=>t.id==='api')!,row=f.archive.get(t);assert.throws(()=>f.archive.get({...t,projectId:'other'}));assert.throws(()=>f.archive.put(t,row.response+' '),/changed/);await f.engine.command('proposal','repair_proposal','api');const book=f.storage.book,x=book.workflows[0].tasks.find(t=>t.id==='api')!,r=JSON.parse(x.proposalRecovery!.correctedResponse);r.summary='changed';x.proposalRecovery!.correctedResponse=JSON.stringify(r);assert.throws(()=>validateWorkflowBook(book,'mock'),/other proposal data/);
 }finally{f.adapter.stop();}
});
test('stale source preview leaves the original failed task intact without a partial recovery',async()=>{
 const f=await fixture();try{const before=f.w();f.port.preview=()=>{throw new Error('Stale source');};await assert.rejects(f.engine.command('proposal','repair_proposal','api'),/Stale/);assert.deepEqual(f.w(),before);assert.equal(f.engine.recoveryError,null);assert.equal(f.w().tasks.find(t=>t.id==='api')!.proposalRecovery,undefined);}finally{f.adapter.stop();}
});
