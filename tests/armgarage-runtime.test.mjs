import {test} from 'node:test';
import assert from 'node:assert/strict';
import {budgets,runBounded,withViewportBrowsers} from '../server/qa-armgarage-image/runtime.mjs';
import {WebQAExecutor,webSupportFiles} from '../server/qa-web.mjs';
import packages from '../server/qa-web-image/package.json' with {type:'json'};

test('bounded runner preserves normal test exits and marks timeout/output/signal as infrastructure',async()=>{
 const execute=(code,options={})=>runBounded(process.execPath,['--input-type=module','--eval',code],{cwd:process.cwd(),timeoutMs:10000,...options});
 assert.equal((await execute('console.log("complete")')).code,0);
 assert.equal((await execute('process.exit(1)')).code,1);
 const timeout=await execute('setInterval(()=>{},1000)',{timeoutMs:100});assert.equal(timeout.code,125);assert.equal(timeout.reason,'timeout');
 const output=await execute('console.log("x".repeat(2048));setInterval(()=>{},1000)',{maxOutput:128});assert.equal(output.code,125);assert.equal(output.reason,'output_limit');
 const signal=await execute('process.exit(143)');assert.equal(signal.code,125);assert.equal(signal.reason,'signal');
 assert(budgets.vitest>45000&&budgets.vitest+1000<budgets.outer);assert(budgets.browser<budgets.outer);
});

test('each viewport has its own sandboxed browser, closed before the next launch',async()=>{
 const events=[];let active=0;
 const chromium={launch:async options=>{assert.equal(active,0);assert.equal(options.chromiumSandbox,true);assert.equal(options.env.HOME,'/tmp');active++;return {close:async()=>{active--;events.push('close');}};}};
 await withViewportBrowsers(chromium,async(_browser,width)=>{events.push(width);},{env:{HOME:'/tmp'}});
 assert.deepEqual(events,[390,'close',768,'close',1440,'close']);assert.equal(active,0);
 await assert.rejects(()=>withViewportBrowsers(chromium,async()=>{throw Error('assertion');},{env:{HOME:'/tmp'}}),/assertion/);assert.equal(active,0);
});

test('ARMGARAGE signal exits are blocked; normal failed assertions remain FAIL; Coffee House budget stays fixed',async()=>{
 const files=['tests/App.test.tsx'];
 const manifest={...packages,name:'armgarage'},sources=[...webSupportFiles,...files].map(path=>({path,text:path==='package.json'?JSON.stringify(manifest):'fixture'}));
 let code=143;const calls=[];const command=async(args,options)=>{calls.push({args,options});if(args[0]==='rm')return {code:0,output:''};if(args.at(-1)==='build')return {code:0,output:JSON.stringify({output:'build',assets:[{path:'index.html',text:'fixture'}]})};return {code,output:'diagnostic'};};
 const executor=new WebQAExecutor({registration:'armgarage',command});executor.ready=true;
 let records=await executor.run({profile:'armgarage_checks',files,sources,revision:'a'.repeat(64)});assert.deepEqual(records.map(r=>r.status),['BLOCKED','PASS','BLOCKED']);
 assert.equal(calls.find(c=>c.args.at(-1)==='vitest').options.timeoutMs,budgets.outer);
 code=1;records=await executor.run({profile:'armgarage_checks',files,sources,revision:'a'.repeat(64)});assert.equal(records[0].status,'FAIL');
 const coffee=new WebQAExecutor({command});await coffee.execute('vitest','{}');assert.equal(calls.at(-2).options.timeoutMs,90000);
});
