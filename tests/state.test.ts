import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOffice,applyUpdate,metrics} from '../src/state/office.ts';
import {statuses} from '../src/domain.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
test('fixed roster, tasks and project stay consistent across all eight statuses',()=>{
 let state=createOffice('2026-11-12T09:00:00.000Z');
 const roster=state.agents.map(a=>a.role);
 assert.equal(new Set(roster).size,8);
 assert.equal(state.projects[0].agents.length,8);
 for(const status of statuses){state=applyUpdate(state,{agentId:'lead',status,progress:status==='Completed'?20:130,timestamp:'2026-11-12T10:00:00.000Z',id:status});const a=state.agents[0],t=state.tasks[0];assert.equal(a.status,status);assert.equal(t.status,status);assert.equal(t.completedAt,status==='Completed'?'2026-11-12T10:00:00.000Z':null);assert.equal(a.progress,status==='Completed'?100:99);assert.deepEqual(state.agents.map(a=>a.role),roster);}
});
test('unknown agents and malformed progress are ignored; activity is bounded',()=>{
 let state=createOffice();const event={agentId:'unknown',status:'Working' as const,progress:50,timestamp:new Date().toISOString(),id:'x'};
 assert.equal(applyUpdate(state,event),state);
 assert.equal(applyUpdate(state,{...event,agentId:'lead',progress:NaN}),state);
 for(let i=0;i<100;i++)state=applyUpdate(state,{...event,agentId:'lead',id:String(i)});
 assert.equal(state.activity.length,80);assert.equal(state.activity[0].id,'99');assert.equal(state.agents.length,8);
});
test('metrics reflect actual tasks',()=>{const m=metrics(createOffice());assert.deepEqual(m,{active:5,total:8,completed:1,inProgress:5,errors:1});});
test('adapter unsubscribe, stop and reset cancel future events',async()=>{
 const adapter=new MockCodexAdapter();let count=0;const unsubscribe=adapter.subscribe(()=>count++);adapter.start();adapter.start();adapter.stop();adapter.reset();unsubscribe();await new Promise(resolve=>setTimeout(resolve,2700));assert.equal(count,0);
});
