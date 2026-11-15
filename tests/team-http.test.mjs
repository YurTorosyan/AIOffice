import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {createBridge} from '../server/http.mjs';
test('team HTTP actions keep CSRF/origin checks, validate employees and never expose generic execution',async()=>{
 const calls=[];const pilot={snapshot:()=>({connection:'disconnected',members:{}}),disconnect(){},async action(action,options){calls.push({action,options});}};
 const bridge=createBridge({pilot,root:resolve('.'),port:0});await bridge.listen();const base=`http://127.0.0.1:${bridge.server.address().port}`;
 try{const session=await(await fetch(base+'/api/codex/session')).json();const headers={'content-type':'application/json','x-ai-office-token':session.token};
  for(const body of [null,[],{action:'start',agentId:'director'},{action:'start',agentId:3},{action:'start',agentId:'qa',prompt:'injected'},{action:'shell',agentId:'qa'},{action:'mock_step',agentId:'qa'},{action:'start',taskId:'foreign'}])assert.equal((await fetch(base+'/api/codex/action',{method:'POST',headers,body:JSON.stringify(body)})).status,400);
  assert.equal(calls.length,0);
  assert.equal((await fetch(base+'/api/codex/action',{method:'POST',headers:{...headers,origin:'https://foreign.example'},body:JSON.stringify({action:'connect_all'})})).status,403);
  assert.equal((await fetch(base+'/api/codex/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'connect_all'})})).status,403);
  assert.equal((await fetch(base+'/api/codex/action',{method:'POST',headers,body:JSON.stringify({action:'resume',agentId:'qa',taskId:'owned-task'})})).status,200);assert.deepEqual(calls.at(-1),{action:'resume',options:{agentId:'qa',taskId:'owned-task',command:undefined}});
  assert.equal((await fetch(base+'/api/codex/action',{method:'POST',headers,body:JSON.stringify({action:'connect_all'})})).status,200);assert.equal(calls.at(-1).action,'connect_all');
 }finally{await bridge.close();}
});
