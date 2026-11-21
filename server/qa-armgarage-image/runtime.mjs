import {spawn} from 'node:child_process';
import fs from 'node:fs';

// Fixed trusted runner budgets. Project files cannot choose commands or timeouts.
export const budgets=Object.freeze({vitest:120000,browser:180000,outer:200000,output:256000});
export function runBounded(command,args,{cwd='/work',env,timeoutMs=budgets.vitest,maxOutput=budgets.output}={}){
 return new Promise(resolve=>{
  const child=spawn(command,args,{cwd,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',bytes=0,reason=null,killTimer;
  const stop=why=>{if(reason)return;reason=why;child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),1000);};
  const timer=setTimeout(()=>stop('timeout'),timeoutMs);
  const capture=b=>{bytes+=b.length;if(bytes>maxOutput){stop('output_limit');return;}output+=b.toString('utf8');};
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  child.on('error',()=>{reason??='spawn_error';});
  child.on('close',(code,signal)=>{clearTimeout(timer);clearTimeout(killTimer);resolve({code:reason||signal||code===null||code>=128?125:code,output,reason:reason??(signal||code>=128?'signal':code===null?'unknown_exit':null),signal:signal??null});});
 });
}
export function resourceSnapshot(){
 const read=name=>{try{return fs.readFileSync('/sys/fs/cgroup/'+name,'utf8').trim().slice(0,500);}catch{return null;}};
 return {memoryCurrent:read('memory.current'),memoryPeak:read('memory.peak'),memoryEvents:read('memory.events'),pidsCurrent:read('pids.current')};
}
export async function withViewportBrowsers(chromium,visit,{widths=[390,768,1440],env,onStage=()=>{}}={}){
 // Closing the entire browser between widths releases renderers, screenshot buffers
 // and temporary profiles, rather than retaining them across the complete journey.
 for(const width of widths){
  onStage('launch',width);
  const browser=await chromium.launch({headless:true,chromiumSandbox:true,...(env?{env}:{})});
  try{await visit(browser,width);}finally{await browser.close();onStage('closed',width);}
 }
}
