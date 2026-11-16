import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teamOutputSchema} from '../server/team-output.mjs';
import {CheckpointPilot} from '../server/checkpoint-pilot.mjs';
import {MemoryCheckpointStorage} from '../src/checkpoints/model.ts';
test('team structured outputs enforce proposal-only evidence and scoped patch paths',()=>{
 const task={id:'implement',teamSpec:{kind:'implementation',scope:['src/helper.ts','tests/helper.test.ts']}},schema=teamOutputSchema(task);assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.filesChanged.maxItems,0);assert.equal(schema.properties.team.properties.tests.maxItems,0);assert.deepEqual(schema.properties.team.properties.patches.items.properties.path.enum,task.teamSpec.scope);assert.equal(schema.properties.team.properties.patches.maxItems,4);
 const qa=teamOutputSchema({...task,teamSpec:{...task.teamSpec,kind:'qa'}});assert.equal(qa.properties.team.properties.patches.maxItems,0);assert.equal(teamOutputSchema({id:'legacy'}),undefined);
});
test('the same outputSchema is passed on initial turn and checkpoint resume; no new permissions',async()=>{
 const p=new CheckpointPilot({root:'.',storage:new MemoryCheckpointStorage('codex'),load:()=>({skills:[],instructions:'Read-only profile',profileHash:'hash'}),context:()=>[]});p.state.connection='connected';p.outputSchema=teamOutputSchema({id:'qa',teamSpec:{kind:'qa',scope:['src/helper.ts']}});const calls=[];let turn=0;
 p.rpc={closed:false,async request(method,params){calls.push({method,params});if(method==='thread/start'||method==='thread/resume')return {thread:{id:'owned-thread',status:{type:'idle'}},sandbox:{type:'readOnly',networkAccess:false},approvalPolicy:'on-request',approvalsReviewer:'user'};if(method==='turn/start'){const id=`turn-${++turn}`;p.notification({method:'turn/started',params:{threadId:params.threadId,turn:{id,status:'inProgress'}}});return {turn:{id}};}if(method==='turn/interrupt'){p.notification({method:'turn/completed',params:{threadId:params.threadId,turn:{id:params.turnId,status:'interrupted'}}});}return {};}};
 await p.start();const id=p.state.taskId;await p.pause();await p.resume(id);const turns=calls.filter(c=>c.method==='turn/start');assert.equal(turns.length,2);for(const c of turns){assert.deepEqual(c.params.outputSchema,p.outputSchema);assert.deepEqual(c.params.sandboxPolicy,{type:'readOnly',networkAccess:false});assert.equal(c.params.approvalsReviewer,'user');}
});
