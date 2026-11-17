// Trusted image entry point. Untrusted project/test code only runs inside disposable containers.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import net from 'node:net';
import {createHash} from 'node:crypto';
const mode=process.argv[2];
const hash=s=>createHash('sha256').update(s).digest('hex');
function writeFiles(files,root){for(const f of files){if(!/^[a-zA-Z0-9_./-]+$/.test(f.path)||f.path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Invalid snapshot path');const file=path.join(root,f.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,f.text,{flag:'wx'});}}
function run(args){const r=spawnSync('/usr/local/bin/node',args,{cwd:'/work',env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp',PLAYWRIGHT_BROWSERS_PATH:'/opt/qa/browsers'},encoding:'utf8',timeout:45000,maxBuffer:256000});return {code:r.status??125,output:(r.stdout??'')+(r.stderr??'')};}
async function browser(assets,probe=false){
 const {chromium}=await import('playwright');
 if(!probe)writeFiles(assets,'/work/dist');
 const server=createServer((req,res)=>{if(probe){res.end('<!doctype html><h1>Isolation probe</h1>');return;}try{const file=path.resolve('/work/dist','.'+new URL(req.url,'http://local').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith('/work/dist/'))throw Error('escape');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]??'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const b=await chromium.launch({headless:true,chromiumSandbox:true});const context=await b.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await context.route('**/*',route=>{if(route.request().url().startsWith(origin+'/')||route.request().url().startsWith('data:'))return route.continue();errors.push('External resource attempted');return route.abort();});
 try{if(probe){await page.goto(origin);assert.equal(await page.locator('h1').innerText(),'Isolation probe');console.log('Chromium sandbox enabled; isolated browser probe passed');return;}
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.goto(origin);await page.getByRole('heading',{level:1,name:'Coffee House',exact:true}).waitFor();assert.equal(await page.locator('#menu li').count(),4);for(const name of ['Espresso','Cappuccino','Flat White','Cold Brew'])assert.equal(await page.locator('#menu').getByRole('heading',{name,exact:true}).count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Menu',exact:true}).click();assert.equal(new URL(page.url()).hash,'#menu');await page.getByRole('heading',{name:'About us',exact:true}).waitFor();await page.getByRole('heading',{name:'Visit Coffee House',exact:true}).waitFor();console.log(`PASS ${width}px: Coffee House, four named drinks, semantic sections/navigation, no horizontal overflow; screenshot sha256=${hash(await page.screenshot({fullPage:true}))}`);}
  assert.deepEqual(errors,[]);console.log('PASS zero page/console errors; external requests blocked; desktop/mobile checks only (not a full accessibility audit)');
 }catch(e){console.error('Browser page errors:',JSON.stringify(errors));console.error('Page text:',(await page.locator('body').innerText()).slice(0,800));throw e;}finally{await b.close();await new Promise(r=>server.close(r));}
}
if(mode==='probe'){
 assert.equal(process.getuid(),1000);const status=fs.readFileSync('/proc/self/status','utf8');assert.match(status,/CapEff:\s+0+\n/);assert.match(status,/NoNewPrivs:\s+1/);assert.equal(fs.existsSync('/var/run/docker.sock'),false);assert.equal(fs.existsSync('/host'),false);assert.equal(process.env.OPENAI_API_KEY,undefined);assert.throws(()=>fs.writeFileSync('/opt/qa/mutation','x'));fs.writeFileSync('/work/probe','scratch');
 await new Promise((resolve,reject)=>{const socket=net.connect({host:'1.1.1.1',port:443});socket.setTimeout(1500);socket.on('connect',()=>{socket.destroy();reject(Error('Network unexpectedly available'));});socket.on('error',()=>{socket.destroy();resolve();});socket.on('timeout',()=>{socket.destroy();reject(Error('Network isolation inconclusive'));});});await browser([],true);
}else{
 const data=JSON.parse(fs.readFileSync(0,'utf8'));
 if(mode==='browser'){await browser(data.assets);}else{
  writeFiles(data.sources,'/work');fs.symlinkSync('/opt/qa/node_modules','/work/node_modules','dir');
  if(mode==='vitest'){const r=run(['/opt/qa/node_modules/vitest/vitest.mjs','run','--config','/opt/qa/vitest.config.mjs','--configLoader','native',...data.files]);process.stdout.write(r.output);process.exitCode=r.code;}
  else if(mode==='build'){
   const types=run(['/opt/qa/node_modules/typescript/bin/tsc','--project','/opt/qa/tsconfig.json']);if(types.code!==0){process.stdout.write(types.output);process.exitCode=types.code;}
   else{const built=run(['/opt/qa/node_modules/vite/bin/vite.js','build','--config','/opt/qa/vite.config.mjs','--configLoader','native']);if(built.code!==0){process.stdout.write(built.output);process.exitCode=built.code;}else{const assets=[];let bytes=0;const visit=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isSymbolicLink())throw Error('Unsafe build artifact');if(item.isDirectory())visit(full);else{const text=fs.readFileSync(full,'utf8');bytes+=Buffer.byteLength(text);if(bytes>4000000||assets.length>=64)throw Error('Build artifact limit');assets.push({path:path.relative('/work/dist',full),text});}}};visit('/work/dist');console.log(JSON.stringify({output:(types.output+built.output).slice(-4500),assets}));}}
  }else throw Error('Unsupported fixed profile');
 }
}
