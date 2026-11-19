import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,renameSync,readFileSync,rmSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {FileCheckpointStorage} from '../server/checkpoint-store.mjs';
import {emptyBook} from '../src/checkpoints/model.ts';
function directory(t){const base=resolve('work/storage-tests');mkdirSync(base,{recursive:true});const root=mkdtempSync(resolve(base,'atomic-'));assert.ok(!relative(base,root).startsWith('..'));t.after(()=>{assert.ok(!relative(base,root).startsWith('..'));rmSync(root,{recursive:true,force:true});});return root;}
test('temporary Windows destination locks retry atomic replacement with bounded backoff',t=>{
 const root=directory(t),delays=[];let attempts=0;const store=new FileCheckpointStorage(root,{rename:(from,to)=>{if(++attempts<3)throw Object.assign(new Error('scanner lock'),{code:'EPERM'});renameSync(from,to);},wait:ms=>delays.push(ms)});
 store.save(emptyBook('codex'));assert.equal(attempts,3);assert.deepEqual(delays,[15,30]);assert.deepEqual(store.load(),emptyBook('codex'));assert.ok(readdirSync(store.directory).every(p=>!p.endsWith('.tmp')));
});
test('persistent destination denial preserves the original book and removes only the failed temporary file',t=>{
 const root=directory(t),good=new FileCheckpointStorage(root);good.save(emptyBook('codex'));const before=readFileSync(good.file,'utf8');let attempts=0;
 const broken=new FileCheckpointStorage(root,{rename:()=>{attempts++;throw Object.assign(new Error('denied'),{code:'EACCES'});},wait:()=>{}});assert.throws(()=>broken.save(emptyBook('codex')),e=>e.code==='STORE_IO'&&e.cause?.message==='denied');assert.equal(attempts,5);assert.equal(readFileSync(good.file,'utf8'),before);assert.ok(readdirSync(good.directory).every(p=>!p.endsWith('.tmp')));
});
