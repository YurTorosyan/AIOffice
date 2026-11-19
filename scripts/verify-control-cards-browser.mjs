/** Isolated Mock UI interactions. Production bridge and project files are never used. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createBridge} from '../server/http.mjs';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
const moduleRoot=resolve(process.env.AI_OFFICE_PLAYWRIGHT_ROOT??'work/browser-validation/node_modules/playwright');
const {chromium}=await import(pathToFileURL(resolve(moduleRoot,'index.mjs')).href);
const {expect:baseExpect}=await import(pathToFileURL(resolve(moduleRoot,'test.mjs')).href),expect=baseExpect.configure({timeout:15000});
const output=resolve('work/control-cards');mkdirSync(output,{recursive:true});
const adapter=new MockCodexAdapter(),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage(),engine=new Orchestrator(port,storage);port.scenario='team-basic';
await adapter.action('connect_all');await engine.create('Собрать компонент записи на сервис с понятной формой и тестами','cards-proof',{team:true});await engine.tick();
for(let n=0;n<2;n++){await port.advance(engine.snapshot().workflows[0].tasks);await engine.tick();}
await engine.command('cards-proof','pause');for(const task of storage.book.workflows[0].tasks)task.branch='main';
const book=structuredClone(storage.book),tasks=adapter.getTasks(),checkpoints=structuredClone(adapter.book),originalApproval=structuredClone(book.workflows[0].team.approvals[0]);adapter.stop();
const bridge=createBridge({root:resolve('.'),port:0,pilot:{snapshot:()=>({}),disconnect(){}}});await bridge.listen();const origin=`http://127.0.0.1:${bridge.server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[],posts=[];
page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{const req=route.request(),url=req.url();if(req.method()!=='GET'){posts.push(req.method());return route.abort();}return url.startsWith(origin+'/')||url.startsWith('data:')?route.continue():route.abort();});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ai-office-orchestrator-v1')).workflows[0]);
try{
 await page.addInitScript(({book,tasks,checkpoints})=>{if(!localStorage.getItem('ai-office-orchestrator-v1')){localStorage.setItem('ai-office-orchestrator-v1',JSON.stringify(book));localStorage.setItem('ai-office:mock-tasks:v1:office-demo',JSON.stringify({version:1,projectId:'office-demo',tasks,activity:[]}));localStorage.setItem('ai-office:mock-checkpoints:v1',JSON.stringify(checkpoints));}},{book,tasks,checkpoints});
 await page.goto(origin);await expect(page.getByRole('group',{name:'Пиксельный офис: восемь рабочих мест'}).getByRole('button')).toHaveCount(8);await expect(page.locator('.control-tools-grid > .control-tool')).toHaveCount(6);
 const workflow=page.getByRole('region',{name:'Управление workflow',exact:true});await expect(workflow.getByRole('button',{name:'Продолжить workflow',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Проверить и одобрить',exact:true}).click();
 assert.equal((await saved()).team.approvals[0].status,'pending');assert.deepEqual((await saved()).team.approvals[0].patches,originalApproval.patches);
 const approval=page.locator('[id="workflow-approval-'+originalApproval.id+'"]');await expect(approval.locator('details').first()).toHaveAttribute('open','');await expect(approval).toContainText('export const mockValue = 1;');
 await page.locator('.team-control-center').screenshot({path:resolve(output,'approval-desktop.png')});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.control-tools-grid > .control-tool')).toHaveCount(6);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.locator('.team-control-center').screenshot({path:resolve(output,'approval-mobile.png')});await page.setViewportSize({width:1440,height:1000});
 await approval.getByRole('button',{name:'Подтвердить это действие',exact:true}).click();await expect.poll(async()=>(await saved()).team.approvals[0].status).toBe('approved');
 assert.equal((await saved()).status,'paused');assert.deepEqual((await saved()).team.approvals[0].patches,originalApproval.patches);
 await page.getByRole('button',{name:'Подключить mock-сессии',exact:true}).click();await expect(workflow.getByRole('button',{name:'Продолжить workflow',exact:true})).toBeEnabled();await workflow.getByRole('button',{name:'Продолжить workflow',exact:true}).click();await expect.poll(async()=>(await saved()).status).toBe('running');
 await expect.poll(async()=>(await saved()).team.approvals.some(a=>a.action==='run_tests'&&a.status==='pending')).toBe(true);
 assert.equal((await saved()).tasks.find(t=>t.teamSpec?.kind==='qa').executionId,null);await workflow.getByRole('button',{name:'Пауза workflow',exact:true}).click();await expect.poll(async()=>(await saved()).status).toBe('paused');
 assert.equal((await saved()).team.approvals.filter(a=>a.status==='approved').length,1);
 const summary=page.locator('.control-tool--project > details > summary');await summary.click();await expect(page.getByRole('heading',{name:'AI Office · ACTIVE',exact:true})).toBeVisible();await summary.click();
 await page.locator('.control-tool--runtime > details > summary').click();await expect(page.getByRole('button',{name:'▷ Запустить workflow',exact:true})).toBeVisible();
 await page.locator('.control-tool--runtime > details > summary').click();await page.reload();await expect(workflow.getByRole('button',{name:'Продолжить workflow',exact:true})).toBeDisabled();assert.equal((await saved()).team.approvals.filter(a=>a.status==='approved').length,1);
 const emptyContext=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),empty=await emptyContext.newPage();empty.on('pageerror',e=>errors.push(e.message));await emptyContext.route('**/*',route=>{const r=route.request();if(r.method()!=='GET'){posts.push(r.method());return route.abort();}return r.url().startsWith(origin+'/')||r.url().startsWith('data:')?route.continue():route.abort();});await empty.goto(origin);await expect(empty.getByRole('region',{name:'Управление workflow',exact:true})).toContainText('От идеи — к работе команды');await expect(empty.getByLabel('Задача команды',{exact:true})).toBeVisible();await expect(empty.locator('.workflow-counter').first()).toContainText('—');await empty.locator('.team-control-center').screenshot({path:resolve(output,'empty-desktop.png')});await emptyContext.close();
 assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);
 const evidence={version:1,mode:'isolated Mock fixture',employees:8,toolCards:6,emptyStateAndTaskForm:true,viewports:[1440,390],mobileHorizontalOverflow:false,reviewDoesNotApprove:true,exactDiffVisible:true,explicitApprovalWorks:true,resumeAndPauseWork:true,qaNeedsSeparateApproval:true,projectAndRuntimeToolsAccessible:true,reloadPreservesApproval:true,realCodexJobs:0,realFileApplications:0,nonGetRequests:posts,pageErrors:errors};writeFileSync(resolve(output,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;}
finally{await browser.close();await bridge.close();}
