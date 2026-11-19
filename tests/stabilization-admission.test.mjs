import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {TeamRuntime,unconfirmedExecution} from '../server/team.mjs';
import {MemoryCheckpointStorage} from '../src/checkpoints/model.ts';
test('unknown execution after restart holds its slot; only its own reconciliation can reserve it',()=>{
 for(const maxActive of [1,2]){
  const team=new TeamRuntime({root:resolve('.'),maxActive,storage:new MemoryCheckpointStorage('codex'),makePilot:options=>({state:{connection:'disconnected',execution:'idle',taskId:null,checkpoints:[]},book:{tasks:[]},snapshot(){return structuredClone(this.state);},disconnect(){}})});
  const lead=team.members.get('lead');Object.assign(lead.state,{execution:'paused',taskId:'owned-task',checkpoints:[{taskId:'owned-task',status:'resumable',lastKnownState:{stopConfirmed:false}}]});
  assert(unconfirmedExecution(lead));assert.deepEqual(team.snapshot().activeEmployees,['lead']);assert.throws(()=>team.reserve('frontend'),/unconfirmed/);assert.throws(()=>team.reserve('lead'),/unconfirmed/);
  team.reserve('lead',true);assert.equal(team.reserved.size,1);assert.throws(()=>team.reserve('lead',true),/capacity/);team.reserved.delete('lead');
  lead.state.checkpoints[0].lastKnownState.stopConfirmed=true;assert(!unconfirmedExecution(lead));team.reserve('frontend');assert.equal(team.reserved.size,1);
 }
});
