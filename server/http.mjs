import {captureDesign,BuildArtifacts} from './build-artifacts.mjs';
import {TeamActions} from './team-actions.mjs';
import {DesignArtifacts} from './design-artifacts.mjs';
import {applyPendingProjectRelocation} from './project-relocation.mjs';
import {resolveControl} from '../src/checkpoints/model.ts';
import {ProjectManager} from './projects.mjs';
import {emptyRuntime} from '../src/integration/RealCodexAdapter.ts';
import {employees} from './employee-config.mjs';
import {safeText} from '../src/security/redaction.ts';
import {createVerifiedQAExecutor} from './qa-executor.mjs';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TeamRuntime } from './team.mjs';
import { employeeIds } from './employee-config.mjs';
import { FileCheckpointStorage } from './checkpoint-store.mjs';
import { createOrchestration } from './orchestration.mjs';
import {SecurityController} from './security.mjs';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
export function createBridge({ pilot:defaultPilot, root, port = 8787, orchestration:defaultOrchestration,projects }) {
  const token = randomBytes(32).toString('hex');
  const server = createServer(async (request, response) => {
    const owned=projects?.runtime;const pilot=projects?(owned?.team??{snapshot:()=>({...emptyRuntime(),projectId:projects.book.activeProjectId??undefined,members:Object.fromEntries(employees.map(e=>[e.id,{...emptyRuntime(),agentId:e.id,role:e.role,projectId:projects.book.activeProjectId??undefined,error:'Select/recover a project before execution'}])),activeEmployees:[],maxActive:2}),disconnect(){},async action(){throw new Error('Project runtime unavailable');}}):defaultPilot;
    const orchestration=projects?owned?.orchestration:defaultOrchestration;const security=orchestration?.permissions?new SecurityController(orchestration.engine,orchestration.permissions):null;
    const runOwned=(projectId,fn,controlOnly=false)=>{if(projects)return projects.withRuntime(projectId,current=>{if(current!==owned)throw new Error('Stale runtime request');return fn();},controlOnly);if(projectId!==undefined&&projectId!==(pilot.projectId??'office-demo'))throw new Error('Project mismatch');return fn();};
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'");
    const reply = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
    // Host validation prevents DNS rebinding; exact-origin checks plus an unpredictable per-process nonce prevent CSRF.
    const host = request.headers.host;
    if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) { reply(403, { error: 'Loopback host required' }); return; }
    if (request.headers.origin && request.headers.origin !== `http://${host}`) { reply(403, { error: 'Origin rejected' }); return; }
    const url=new URL(request.url, `http://${host}`),path=url.pathname;
    if(projects&&request.method==='GET'&&/^\/api\/(?:codex|workflows|security)\/snapshot$/.test(path)&&url.searchParams.has('projectId')&&url.searchParams.get('projectId')!==projects.book.activeProjectId){reply(409,{error:'Stale project request'});return;}
    if(projects&&request.method==='GET'&&path==='/api/projects/snapshot'){reply(200,projects.snapshot());return;}
    if(projects&&request.method==='GET'&&path==='/api/projects/tasks'){try{reply(200,{projectId:projects.book.activeProjectId,tasks:projects.tasks(Object.fromEntries(url.searchParams))});}catch(e){reply(409,{error:safeText(e.message).slice(0,300)});}return;}
    if(projects&&request.method==='POST'&&['/api/projects/action','/api/repository/action'].includes(path)){
      const provided=Buffer.from(String(request.headers['x-ai-office-token']||''));if(provided.length!==token.length||!timingSafeEqual(provided,Buffer.from(token))){reply(403,{error:'Invalid session'});return;}if(request.headers['content-type']!=='application/json'){reply(415,{error:'JSON required'});return;}
      try{let body='';for await(const chunk of request){body+=chunk;if(body.length>8192){reply(413,{error:'Request too large'});return;}}const data=JSON.parse(body);reply(200,path==='/api/projects/action'?await projects.command(data):await projects.gitCommand(data));}catch(e){reply(409,{error:safeText(e.message).slice(0,500),projects:projects.snapshot()});}return;
    }
    if (request.method === 'GET' && path === '/api/codex/session') { reply(200, { token }); return; }
    if(orchestration&&path.startsWith('/api/design/')){try{
      const store=new DesignArtifacts(pilot.root??projects?.runtime?.team.root??root,pilot.projectId??'office-demo');
      if(request.method==='GET'&&path==='/api/design/builds'){reply(200,new BuildArtifacts(store.boundary.root,pilot.projectId).list(url.searchParams.get('workflowId')));return;}if(request.method==='GET'&&path==='/api/design/artifact'){const row=store.get(url.searchParams.get('id'),url.searchParams.get('workflowId'));response.writeHead(200,{'Content-Type':'image/png','X-Content-Type-Options':'nosniff'});response.end(row.bytes);return;}
      if(request.method!=='POST'||request.headers['content-type']!=='application/json')throw Error('JSON POST required');const provided=Buffer.from(String(request.headers['x-ai-office-token']||''));if(provided.length!==token.length||!timingSafeEqual(provided,Buffer.from(token)))throw Error('Invalid session');
      let body='';for await(const chunk of request){body+=chunk;if(body.length>14000000)throw Error('Design request too large');}const data=JSON.parse(body);if(data.projectId!==pilot.projectId)throw Error('Foreign design project');
      if(path==='/api/design/import'){const w=orchestration.engine.snapshot().workflows.find(w=>w.id===data.workflowId);if(!w?.design||['completed','cancelled'].includes(w.status))throw Error('Active design workflow required');reply(200,await runOwned(data.projectId,()=>store.put(Buffer.from(data.base64,'base64'),{workflowId:data.workflowId,kind:'concept',provenance:data.provenance})));return;}
      if(path==='/api/design/capture'){reply(200,await runOwned(data.projectId,async()=>{const w=orchestration.engine.snapshot().workflows.find(w=>w.id===data.workflowId);if(!w?.design?.conceptApproved||w.status!=='paused'||pilot.snapshot().activeEmployees?.length)throw Error('Pause workflow and employees before capture');if(w.design.visual)return orchestration.engine.snapshot();const actions=new TeamActions(store.boundary.root,{permissions:orchestration.permissions});const evidence=await captureDesign(store.boundary.root,pilot.projectId,w,data.buildId,actions,data.requestId);await orchestration.engine.designAction(w.id,{requestId:data.requestId,action:'submit_visual',revision:w.design.revision,visual:evidence});return orchestration.engine.snapshot();}));return;}
      if(path!=='/api/design/action'||request.method!=='POST')throw Error('Unknown design operation');
      if(data.decision.action==='approve_concept'){const w=orchestration.engine.snapshot().workflows.find(w=>w.id===data.workflowId),c=w?.design?.concepts.find(c=>c.id===data.decision.conceptId);if(!c)throw Error('Concept missing');for(const ref of [c.desktop,c.mobile])store.get(ref.id,data.workflowId);}if(data.decision.action==='accept_visual'){const w=orchestration.engine.snapshot().workflows.find(w=>w.id===data.workflowId),qa=w?.tasks.find(t=>t.id===w.team?.gates.qa),actions=new TeamActions(store.boundary.root,{permissions:orchestration.permissions});if(!qa||!w.design.visual||actions.verificationRevision(qa.teamSpec.scope)!==w.design.visual.implementationRevision)throw Error('Visual evidence is stale');for(const ref of w.design.visual.screenshots)store.get(ref.id,data.workflowId);}if(data.decision.action==='submit_concepts')for(const c of data.decision.concepts??[])for(const ref of [c.desktop,c.mobile]){const row=store.get(ref.id,data.workflowId);if(JSON.stringify(row.ref)!==JSON.stringify(ref))throw Error('Artifact changed');}
      if(data.decision.action==='submit_visual')throw Error('Verified implementation capture provider required; arbitrary screenshots cannot be accepted');
      await runOwned(data.projectId,()=>orchestration.engine.designAction(data.workflowId,data.decision));reply(200,orchestration.engine.snapshot());
    }catch(e){reply(409,{error:safeText(e.message).slice(0,500)});}return;}
    if (request.method === 'GET' && path === '/api/codex/snapshot') { reply(200, pilot.snapshot()); return; }
    if (orchestration && request.method==='GET' && path==='/api/workflows/snapshot'){reply(200,orchestration.engine.snapshot());return;}
    if(security&&request.method==='GET'&&path==='/api/security/snapshot'){reply(200,security.snapshot());return;}
    if(security&&request.method==='POST'&&path==='/api/security/request'){
      const provided=Buffer.from(String(request.headers['x-ai-office-token']||''));if(provided.length!==token.length||!timingSafeEqual(provided,Buffer.from(token))){reply(403,{error:'Invalid session'});return;}
      if(request.headers['content-type']!=='application/json'){reply(415,{error:'JSON required'});return;}
      try{let body='';for await(const chunk of request){body+=chunk;if(body.length>4096){reply(413,{error:'Request too large'});return;}}const data=JSON.parse(body),{projectId,...payload}=data;const result=await runOwned(projectId,()=>security.request(payload));reply(200,result);}catch{reply(409,{error:'Permission request denied; inspect the security audit.'});}return;
    }
    if (orchestration && request.method==='POST' && path==='/api/workflows/action'){
      const provided=Buffer.from(String(request.headers['x-ai-office-token']||''));
      if(provided.length!==token.length||!timingSafeEqual(provided,Buffer.from(token))){reply(403,{error:'Invalid session'});return;}
      if(request.headers['content-type']!=='application/json'){reply(415,{error:'JSON required'});return;}
      try{let body='';for await(const chunk of request){body+=chunk;if(body.length>8192){reply(413,{error:'Request too large'});return;}}
       const data=JSON.parse(body);if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!['action','workflowId','rootTask','taskId','team','maxCycles','projectId'].includes(k))||!['create','pause','resume','cancel','retry','reject_approval','approve_action','reject_action','refresh_action','recheck_gate','prepare_plan_repair','apply_plan_repair','revise_plan','reconcile_unsubmitted','revalidate_result','defer_verification','retry_with_context','repair_proposal','reconcile_storage','restore_cancelled','prepare_operation_recovery','confirm_operation_recovery','cleanup_operation'].includes(data.action)||typeof data.workflowId!=='string'||(data.taskId!==undefined&&typeof data.taskId!=='string')||(data.action==='create'?(typeof data.rootTask!=='string'||data.taskId!==undefined):data.rootTask!==undefined)||((data.team!==undefined||data.maxCycles!==undefined)&&data.action!=='create')||(data.team!==undefined&&typeof data.team!=='boolean')||(data.maxCycles!==undefined&&(!Number.isInteger(data.maxCycles)||data.maxCycles<0||data.maxCycles>3)))throw new Error('Invalid workflow command');
       await runOwned(data.projectId,()=>data.action==='create'?orchestration.engine.create(data.rootTask,data.workflowId,...(data.team?[{team:true,maxCycles:data.maxCycles}]:[])):orchestration.engine.command(data.workflowId,data.action,data.taskId),['pause','cancel','reject_action','reject_approval','reconcile_storage','restore_cancelled','prepare_operation_recovery','confirm_operation_recovery','cleanup_operation'].includes(data.action));
       reply(200,orchestration.engine.snapshot());
      }catch(error){reply(409,{code:error.code??'WORKFLOW_ACTION_REJECTED',error:safeText(error.message??'Workflow command rejected').slice(0,1000),snapshot:orchestration.engine.snapshot()});}return;
    }
    if (request.method === 'POST' && path === '/api/codex/action') {
      const provided = Buffer.from(String(request.headers['x-ai-office-token'] || ''));
      if (provided.length !== token.length || !timingSafeEqual(provided, Buffer.from(token))) { reply(403, { error: 'Invalid session' }); return; }
      if (request.headers['content-type'] !== 'application/json') { reply(415, { error: 'JSON required' }); return; }
      try {
        let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 1024) { reply(413, { error: 'Request too large' }); return; } }
        const data = JSON.parse(body);
        const methods = { connect: () => pilot.connect(), start: () => pilot.start(), interrupt: () => pilot.interrupt(), reject: () => pilot.rejectApproval(), disconnect: () => pilot.disconnect(), pause:()=>pilot.pause(),resume:()=>pilot.resume(data.taskId),checkpoint:()=>pilot.checkpoint(),control:()=>pilot.control(data.command,data.taskId) };
        if(!data||typeof data!=='object'||Array.isArray(data)){reply(400,{error:'Invalid pilot action'});return;}
        if (data?.agentId !== undefined && !employeeIds.includes(data.agentId)) { reply(400,{error:'Invalid employee'});return; }
        if (typeof pilot.action==='function') { for(const key of ['connect_all','disconnect_all'])methods[key]=()=>pilot.action(key); for(const key of ['connect','start','interrupt','reject','disconnect','pause','resume','checkpoint','control'])methods[key]=()=>pilot.action(key,{agentId:data.agentId??'lead',taskId:data.taskId,command:data.command}); }
        if (!data || typeof data !== 'object' || !Object.hasOwn(methods, data.action) || Object.keys(data).some(k => !['action','agentId','taskId','command','projectId'].includes(k)) || (data.taskId !== undefined && (typeof data.taskId !== 'string' || data.taskId.length > 160 || !['resume','control'].includes(data.action))) || (data.command !== undefined && (typeof data.command !== 'string' || data.command.length > 100 || data.action !== 'control')) || (data.action==='control' && typeof data.command!=='string')) { reply(400, { error: 'Invalid pilot action' }); return; }
        if(orchestration&&data.action==='start'&&orchestration.engine.snapshot().workflows.some(w=>!['completed','cancelled'].includes(w.status)))throw new Error('Workflow owns execution scheduling');
        await runOwned(data.projectId,()=>methods[data.action](),(['pause','interrupt','reject','disconnect','disconnect_all','checkpoint'].includes(data.action)||data.action==='control'&&['pause','checkpoint','show'].includes(resolveControl(data.command)))); reply(200, pilot.snapshot());
      } catch (error) {
        const publicErrors = ['Выберите задачу: доступно несколько контрольных точек','Нет задачи для возобновления','Используйте: Пауза, Продолжим работу, Показать checkpoint, Где остановились','A task is already running','No running task to pause'];
        reply(409, { error: publicErrors.includes(error.message)?error.message:'Pilot action failed; inspect connection status', snapshot: pilot.snapshot() });
      }
      return;
    }
    if (request.method !== 'GET' || path.startsWith('/api/')) { reply(404, { error: 'Not found' }); return; }
    try {
      const dist = resolve(root, 'dist'), file = resolve(dist, '.' + (path === '/' ? '/index.html' : decodeURIComponent(path)));
      const rel = relative(dist, file);
      if (rel.startsWith('..') || !types[extname(file)] || !statSync(file).isFile()) throw new Error();
      response.writeHead(200, { 'Content-Type': types[extname(file)] }); response.end(readFileSync(file));
    } catch { reply(404, { error: 'Build the office first, or use the Vite development server' }); }
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  return { server, listen: () => new Promise(resolve => server.listen(port, '127.0.0.1', resolve)),
    close: () => { projects?.close();defaultOrchestration?.close(); defaultPilot?.disconnect(); server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const storage=new FileCheckpointStorage(root);const unlock=storage.acquireLock();
  applyPendingProjectRelocation(root);
  const confinedExecutor=await createVerifiedQAExecutor();
  const projects=new ProjectManager(root,{confinedExecutor});await projects.initialize();
  const bridge = createBridge({root,projects});
  bridge.server.once('error',()=>{unlock();process.exitCode=1;});
  process.on('exit',unlock);
  await bridge.listen(); console.log('AI Office bridge: http://127.0.0.1:8787 (Stage 9 resource orchestration; project management; isolated QA; mock default; eight isolated read-only employees)');
  const stop = () => bridge.close().then(() => {unlock();process.exit();});
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
