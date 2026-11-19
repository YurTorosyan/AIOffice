import {noRepository,projectContext} from '../src/projects/model.ts';
/** Fresh browser + fixture-only loopback server. Never opens the user's running bridge. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createBridge} from '../server/http.mjs';
import {emptyRuntime} from '../src/integration/RealCodexAdapter.ts';
import {emptyPermissions} from '../src/security/policy.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {employees} from '../server/employee-config.mjs';
const moduleRoot=resolve(process.env.AI_OFFICE_PLAYWRIGHT_ROOT??'work/browser-validation/node_modules/playwright');
const {chromium}=await import(pathToFileURL(resolve(moduleRoot,'index.mjs')).href);
const {expect:baseExpect}=await import(pathToFileURL(resolve(moduleRoot,'test.mjs')).href),expect=baseExpect.configure({timeout:15000});
const output=resolve('work/stabilization-browser');mkdirSync(output,{recursive:true});
const adapter=new MockCodexAdapter(),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage(),engine=new Orchestrator(port,storage);port.scenario='team-basic';
await adapter.action('connect_all');await engine.create('Stabilization browser fixture: preserve completed proposal','browser-proof',{team:true});await engine.tick();
for(let n=0;n<2;n++){await port.advance(engine.snapshot().workflows[0].tasks);await engine.tick();}
const proposal=structuredClone(engine.snapshot().workflows[0].team.approvals[0]);assert(proposal);await engine.command('browser-proof','cancel');
for(const task of storage.book.workflows[0].tasks)task.branch='main';
const tasks=adapter.getTasks(),checkpoints=structuredClone(adapter.book),book=structuredClone(storage.book);adapter.stop();
const runtime={...emptyRuntime(),projectId:'office-demo',members:Object.fromEntries(employees.map(e=>[e.id,{...emptyRuntime(),agentId:e.id,role:e.role}])),activeEmployees:[],maxActive:2};
const realSnapshot={projectId:'office-demo',version:1,source:'codex',workflows:[],events:[],diagnostics:[],recoveryError:null,lastSavedAt:new Date().toISOString()};
const now=new Date().toISOString(),project={id:'office-demo',name:'Isolated browser fixture',description:'No real project',status:'ACTIVE',workspaceRoot:resolve('work/stabilization-browser/fixture'),repository:noRepository(resolve('work/stabilization-browser/fixture')),defaultBranch:null,createdAt:now,updatedAt:now,lastOpenedAt:null},catalog={version:1,activeProjectId:project.id,projects:[project],events:[],error:null,activeContext:projectContext(project,'codex')};
let realCommands=0,offline=false,workflowReads=0;
const bridge=createBridge({root:resolve('.'),port:0,pilot:{projectId:'office-demo',snapshot:()=>runtime,disconnect(){},action(){realCommands++;throw Error('Real jobs forbidden');}},orchestration:{engine:{snapshot:()=>realSnapshot,command(){realCommands++;throw Error('Real commands forbidden');}},close(){}}});
await bridge.listen();const origin=`http://127.0.0.1:${bridge.server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage(),pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
await context.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(origin+'/')&&!url.startsWith('data:'))return route.abort();
 if(url.includes('/api/projects/snapshot'))return route.fulfill({json:catalog});
 if(url.includes('/api/workflows/snapshot')){workflowReads++;if(offline)return route.abort();}
 if(url.includes('/api/security/snapshot'))return route.fulfill({json:{...emptyPermissions(),available:false,error:'Fixture: no real executor'}});
 return route.continue();});
try{
 await page.addInitScript(({book,tasks,checkpoints})=>{if(!localStorage.getItem('ai-office-orchestrator-v1')){localStorage.setItem('ai-office-orchestrator-v1',JSON.stringify(book));localStorage.setItem('ai-office:mock-tasks:v1:office-demo',JSON.stringify({version:1,projectId:'office-demo',tasks,activity:[]}));localStorage.setItem('ai-office:mock-checkpoints:v1',JSON.stringify(checkpoints));}},{book,tasks,checkpoints});
 await page.goto(origin);await expect(page.getByRole('group',{name:'Пиксельный офис: восемь рабочих мест'}).getByRole('button')).toHaveCount(8);
 const openPanel=async()=>{const summary=page.locator('summary').filter({hasText:/^Team workflow/}).first();if(await summary.locator('..').getAttribute('open')===null)await summary.click();};await openPanel();
 await page.getByRole('button',{name:'Восстановить выбранный workflow на паузе',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Требуется подтверждение/})).toBeVisible();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-office-orchestrator-v1')).workflows[0]),fresh=after.team.approvals.find(a=>a.status==='pending');
 assert.equal(after.status,'paused');assert.equal(after.team.approvals.find(a=>a.id===proposal.id).status,'rejected');assert.notEqual(fresh.id,proposal.id);assert.deepEqual(fresh.patches,proposal.patches);assert.equal(fresh.revision,null);
 await page.getByText('Причины ожидания и состояние данных',{exact:true}).click();await expect(page.getByText(/общий бюджет попыток:/).first()).toBeVisible();
 await page.screenshot({path:resolve(output,'recovered-desktop.png'),fullPage:true});
 await page.reload();await openPanel();await expect(page.getByRole('heading',{name:/Требуется подтверждение/})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(output,'recovered-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Codex team →',exact:true}).click();await openPanel();
 await expect.poll(()=>page.getByRole('region',{name:'Управление workflow',exact:true}).textContent()).toContain('КОМАНДА CODEX');
 await expect.poll(()=>workflowReads).toBeGreaterThan(0);offline=true;await expect(page.getByRole('region',{name:'Управление workflow',exact:true}).getByText('Мост недоступен; показано последнее полученное состояние',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Управление workflow',exact:true}).getByText(/Последнее получение данных:/)).toBeVisible();await page.screenshot({path:resolve(output,'stale-snapshot.png'),fullPage:true});
 assert.equal(realCommands,0);assert.deepEqual(pageErrors,[]);
 const evidence={version:1,browser:'fresh installed Chromium via Playwright',originKind:'ephemeral fixture-only loopback',employees:8,selectedCancellationRecovery:true,proposalPreserved:true,oldApprovalRejected:true,freshApprovalPending:true,reloadPreserved:true,diagnosticsVisible:true,offlineStateExplicit:true,viewports:[1440,390],realCodexJobs:0,realCommands,projectFilesApplied:0,pageErrors};
 writeFileSync(resolve(output,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;}
finally{await browser.close();await bridge.close();}
