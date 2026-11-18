/** Fresh Mock-only browser; no project file application, test approvals or Codex turns. */
import {resolve} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '../work/browser-validation/node_modules/playwright/index.mjs';
import {expect as baseExpect} from '../work/browser-validation/node_modules/playwright/test.mjs';
import {createBridge} from '../server/http.mjs';
import {Orchestrator} from '../src/orchestration/Orchestrator.ts';
import {MockCodexAdapter} from '../src/integration/MockCodexAdapter.ts';
import {MockExecutionPort,MemoryWorkflowStorage} from '../src/orchestration/MockExecutionPort.ts';
const expect=baseExpect.configure({timeout:15000}),adapter=new MockCodexAdapter(),port=new MockExecutionPort(adapter),storage=new MemoryWorkflowStorage();
const raw=readFileSync('tests/fixtures/oversized-team-plan.json','utf8');await adapter.action('connect_all');port.start=async()=>{};port.read=t=>({id:t.executionId,status:'completed',result:raw});
const engine=new Orchestrator(port,storage);await engine.create('Recover scoped public garage plan','browser-plan',{team:true});await engine.tick();await engine.tick();
const w=storage.book.workflows[0],original=structuredClone(w.tasks[0]);for(const t of w.tasks)t.branch='main';adapter.stop();
const bridge=createBridge({root:resolve('.'),port:0,pilot:{snapshot:()=>({}),disconnect(){}}});await bridge.listen();const origin=`http://127.0.0.1:${bridge.server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin+'/')||r.request().url().startsWith('data:')?r.continue():r.abort());
try{
 await page.addInitScript(book=>{if(!localStorage.getItem('ai-office-orchestrator-v1'))localStorage.setItem('ai-office-orchestrator-v1',JSON.stringify(book));},storage.book);await page.goto(origin);
 await expect(page.getByRole('group',{name:'Пиксельный офис: восемь рабочих мест'}).getByRole('button')).toHaveCount(8);
 await page.locator('summary').filter({hasText:/^Team workflow/}).click();const section=page.getByRole('region',{name:'Восстановление плана'});await expect(section).toBeVisible();
 await section.locator('summary').filter({hasText:/Исходный ответ Lead/}).click();await expect(section.getByText(/scope_limit:.*9 \/ 8/)).toBeVisible();await expect(section.getByText('SHA-256:',{exact:false})).toBeVisible();
 await section.locator('summary').filter({hasText:'Коррекция: 9 → 8 файлов'}).click();await expect(section.getByText('tests/ServiceCatalog.test.tsx → tests/App.test.tsx',{exact:false})).toBeVisible();
 await section.getByRole('button',{name:'Применить коррекцию плана · без изменения файлов',exact:true}).click();await expect(section.getByRole('heading',{name:'Проверка плана · applied'})).toBeVisible();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-office-orchestrator-v1')).workflows[0]);assert.equal(after.status,'paused');assert.equal(after.planned,true);assert.equal(after.tasks[0].executionId,original.executionId);assert.deepEqual(after.tasks[0].result,original.result);assert.equal(after.planRecovery.responses[0].text,raw);assert.equal(new Set(after.tasks.flatMap(t=>t.teamSpec.scope)).size,8);assert(after.tasks.slice(1).every(t=>t.executionId===null&&t.status==='pending'));assert.equal(after.team.approvals.length,0);
 await page.reload();await page.locator('summary').filter({hasText:/^Team workflow/}).click();await expect(page.getByRole('region',{name:'Восстановление плана'}).getByRole('heading',{name:'Проверка плана · applied'})).toBeVisible();assert.deepEqual(errors,[]);await page.screenshot({path:'work/plan-recovery-browser.png',fullPage:true});
 writeFileSync('docs/PLAN_RECOVERY_BROWSER_EVIDENCE.json',JSON.stringify({mode:'isolated Mock UI',employees:8,diagnosticsVisible:true,originalResponseAndHashVisible:true,correctionPreviewVisible:true,filesBefore:9,filesAfter:8,originalLeadIdentityPreserved:true,reloadPreserved:true,workflowPaused:true,downstreamExecutions:0,automaticApprovals:0,realCodexJobs:0,pageErrors:errors},null,2)+'\n');console.log('PASS full plan recovery UI: diagnostics, SHA, preview, 9→8 correction, reload; 8 employees; no downstream execution, file application or Codex jobs.');
}finally{await browser.close();await bridge.close();}
