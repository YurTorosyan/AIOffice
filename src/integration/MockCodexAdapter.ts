import {MockTaskStorage} from '../tasks/browser.ts';
import type {ProjectContext} from '../projects/model.ts';
import type {PilotAction,PilotOptions,RuntimeSnapshot,RuntimeEvent} from './runtime.ts';
import type { OfficeCommand, Task, TaskStatus, EventType } from '../domain.ts';
import { emptyBook, latestCheckpoint, validateBook, resolveControl, safeText, MemoryCheckpointStorage, type CheckpointStorage, type RecoveryBook, type TaskCheckpoint, type PauseReason } from '../checkpoints/model.ts';
import { BrowserCheckpointStorage } from '../checkpoints/browser.ts';
import { configuration } from '../config.ts';
import type { CodexAdapter } from './CodexAdapter.ts';
import { TaskSystem } from '../tasks/TaskSystem.ts';
import { MockTeamWorkflow } from './MockTeamWorkflow.ts';
export class MockCodexAdapter implements CodexAdapter {
  readonly source = 'mock' as const;
  readonly projectId:string;projectContext?:ProjectContext;
  private system = new TaskSystem();
  private connectedEmployees=new Set<string>();
  private workflow = new MockTeamWorkflow(this.system);
  private timer: ReturnType<typeof setInterval> | undefined;
  private taskStorage:MockTaskStorage;
  private storage: CheckpointStorage; private book: RecoveryBook = emptyBook('mock'); private recoveryError: string | null = null;
  constructor(storage?:CheckpointStorage,context?:ProjectContext,persistTasks=true) {
    this.taskStorage=new MockTaskStorage(context?.projectId??'office-demo',persistTasks);this.projectId=context?.projectId??'office-demo';this.projectContext=context;this.system=new TaskSystem(this.projectId,context?.currentBranch??null);this.workflow=new MockTeamWorkflow(this.system);this.storage=storage??(typeof window==='undefined'?new MemoryCheckpointStorage():new BrowserCheckpointStorage(this.projectId));
    try {
      const savedState=this.taskStorage.load();if(savedState){for(const task of [...savedState.tasks].sort((a,b)=>Number(!['completed','failed'].includes(a.status))-Number(!['completed','failed'].includes(b.status))))this.system.restoreTask(task);this.system.restoreActivity(savedState.activity);}
      this.book = validateBook(this.storage.load(),'mock');if([...this.book.tasks,...this.book.checkpoints].some(r=>r.projectId!==this.projectId||'workspaceRoot' in r&&r.workspaceRoot&&r.workspaceRoot!==this.projectContext?.workspaceRoot))throw new Error('Mock project mismatch');
      for(const task of this.book.tasks.filter(t=>['paused','in_progress'].includes(t.status))){const cp=[...this.book.checkpoints].reverse().find(c=>c.taskId===task.id);if(!cp)throw new Error('Missing mock recovery context');if(!cp.resumable){cp.resumable=true;cp.status='resumable';cp.reason='connection_lost';cp.lastKnownState.stopConfirmed=true;task.status='paused';}this.restore(cp);}
      for(const task of this.getTasks().filter(t=>['in_progress','review','testing'].includes(t.status)&&!this.book.tasks.some(saved=>saved.id===t.id)))this.pauseTask(task.id,'connection_lost');
      if(this.book.tasks.length)this.save();
    }
    catch { this.recoveryError = 'Mock checkpoint повреждён или недоступен. Исходные данные не перезаписаны.'; }
    this.system.events.subscribe(()=>{if(!this.recoveryError)try{this.taskStorage.save(this.getTasks(),this.getEvents());}catch{this.recoveryError='Mock task storage unavailable; original project state preserved';}});
  }
  updateProjectContext(context:ProjectContext){if(context.projectId!==this.projectId||this.projectContext&&context.workspaceRoot!==this.projectContext.workspaceRoot)throw new Error('Mock context mismatch');this.projectContext=context;this.system.branch=context.currentBranch;}
  getCheckpoints = () => structuredClone(this.book.checkpoints);
  /** Orchestrator uses the same task state and Stage 4B storage, with a traceable execution ID. */
  startOrchestrated(agentId:string,id:string,title:string,description:string,workflowId?:string) {
    if(!/^[a-zA-Z0-9_.:-]{1,160}$/.test(id)||!this.getAgents().some(a=>a.id===agentId)||this.getTasks().some(t=>t.id===id||t.assignedAgent===agentId&&!['completed','failed'].includes(t.status)))throw new Error('Mock employee unavailable or duplicate execution');
    if(['running','paused'].includes(this.workflow.getSnapshot().status))throw new Error('Legacy mock workflow active');
    const now=new Date().toISOString();this.connectedEmployees.add(agentId);
    this.system.restoreTask({projectId:this.projectId,branch:this.projectContext?.currentBranch??null,updatedAt:now,workflowId,id,title:safeText(title),description:safeText(description),assignedAgent:agentId,status:'in_progress',priority:'normal',progress:0,createdAt:now,startedAt:now,completedAt:null});
    this.log('task_created',id,'Orchestrator assigned read-only mock analysis');this.log('task_started',id,'Mock execution started');this.checkpoint('manual_checkpoint',id);
  }
  getRecoveryError = () => this.recoveryError;
  private save() { this.storage.save(this.book); }
  private log(type: EventType,taskId: string,text: string) { this.system.recordRecovery(type,taskId,`mock · ${text}`); }
  private restore(cp: TaskCheckpoint) {
    const task: Task = { projectId:this.projectId,id:cp.taskId,title:cp.taskTitle,description:cp.taskDescription,status:'paused',assignedAgent:cp.agentId,priority:cp.lastKnownState.taskPriority??'normal',progress:cp.lastKnownState.progress,
      createdAt:this.book.tasks.find(t=>t.id===cp.taskId)?.createdAt??cp.lastKnownState.startedAt,startedAt:cp.lastKnownState.startedAt,completedAt:null,pauseReason:cp.reason,checkpointId:cp.id };
    this.system.restoreTask(task); if (cp.lastKnownState.workflowStep !== null) this.workflow.restore(task.id,cp.lastKnownState.workflowStep);
    this.log('checkpoint_restored',task.id,'Восстановлена пауза; выполнение автоматически не начато');
  }
  checkpoint(reason: PauseReason = 'manual_checkpoint',taskId?: string) {
    if (this.recoveryError) throw new Error(this.recoveryError);
    const candidates = this.getTasks().filter(t => !['completed','failed'].includes(t.status) && (!taskId || t.id === taskId));
    if (candidates.length !== 1) throw new Error('Выберите одну незавершённую задачу');
    const task = candidates[0], before = task.status === 'paused' ? [...this.book.checkpoints].reverse().find(c => c.taskId === task.id)?.lastKnownState.taskStatus ?? 'in_progress' : task.status;
    const description = safeText(task.description || task.title), agentId = task.assignedAgent ?? 'lead';
    const record = this.book.tasks.find(t => t.id === task.id);
    const row = { id:task.id,title:safeText(task.title),description,agentId,projectId:this.projectId,status:task.status==='paused'?'paused' as const:'in_progress' as const,createdAt:task.createdAt,completedAt:null };
    if (record) Object.assign(record,row); else this.book.tasks.push(row);
    const workflow = this.workflow.getRecovery(); const step = workflow.taskId === task.id ? workflow.step : null;
    const cp: TaskCheckpoint = { id:crypto.randomUUID(),taskId:task.id,agentId,projectId:this.projectId,workspaceRoot:this.projectContext?.workspaceRoot,...(this.projectContext?{branch:this.projectContext.currentBranch}:{}),source:'mock',reason,status:task.status==='paused'?'resumable':'paused',
      taskTitle:row.title,taskDescription:description,taskStatus:task.status,completedWork:step!==null?[`Mock workflow: подтверждено ${step} из 8 шагов`]:[`Подтверждённый прогресс mock: ${task.progress}%`],
      remainingWork:[step!==null?`Продолжить mock workflow с шага ${step+1}`:'Продолжить незавершённую mock задачу'],importantDecisions:['Mock only; no Codex runtime or verified real limit is represented.'],relevantFiles:[],
      lastKnownState:{ execution:task.status,connection:'mock',turnId:null,startedAt:task.startedAt ?? task.createdAt,plan:[],workNotes:[],stopConfirmed:task.status==='paused',taskStatus:before,progress:task.progress,workflowStep:step,limitCode:null,taskPriority:task.priority },
      codexThreadId:null,createdAt:new Date().toISOString(),resumable:task.status==='paused' };
    this.book.checkpoints.push(cp); this.save(); this.log('checkpoint_created',task.id,'Checkpoint сохранён'); return structuredClone(cp);
  }
  pauseTask(taskId?: string,reason: PauseReason = 'user_pause') {
    const tasks = this.getTasks().filter(t => !['completed','failed','paused'].includes(t.status) && (!taskId || taskId===t.id));
    if (tasks.length !== 1) throw new Error('Выберите выполняемую задачу');
    const task = tasks[0]; this.stop(); this.log('task_pause_requested',task.id,'Пауза запрошена');
    const before = task.status; this.system.restoreTask({ ...task,assignedAgent:task.assignedAgent ?? 'lead',status:'paused',pauseReason:reason });
    const cp = this.checkpoint(reason,task.id); const saved = this.book.checkpoints.find(c => c.id===cp.id)!; saved.lastKnownState.taskStatus = before;
    this.system.restoreTask({ ...this.getTasks().find(t => t.id===task.id)!,checkpointId:cp.id }); this.save(); this.log(reason==='limit_reached'?'task_paused_limit':'task_paused',task.id,`Задача приостановлена: ${reason}`);
  }
  resumeTask(taskId?: string) {
    const cp = latestCheckpoint(validateBook(this.book,'mock'),taskId);
    if(cp.projectId!==this.projectId||cp.workspaceRoot&&cp.workspaceRoot!==this.projectContext?.workspaceRoot||cp.branch!==undefined&&cp.branch!==this.projectContext?.currentBranch)throw new Error('Checkpoint project/workspace/branch mismatch');
    const existing = this.getTasks().find(t => t.id === cp.taskId);
    if (existing && ['completed','failed'].includes(existing.status)) throw new Error('Задача уже закрыта');
    if (!existing) this.restore(cp);
    this.log('task_resume_requested',cp.taskId,'Возобновление запрошено');
    const task = this.getTasks().find(t => t.id===cp.taskId)!;
    this.system.restoreTask({ ...task,status:cp.lastKnownState.taskStatus as TaskStatus,pauseReason:undefined });
    for (const saved of this.book.checkpoints.filter(c => c.taskId===cp.taskId)) { saved.resumable = false; saved.status = 'resumed'; }
    this.book.tasks.find(t => t.id===cp.taskId)!.status = 'in_progress'; this.save(); this.log('task_resumed',task.id,'Продолжение с сохранённого шага');
    if (cp.lastKnownState.workflowStep !== null) this.start();
  }
  controlTask(command: string,taskId?: string) {
    const action = resolveControl(command); if (action==='pause') return this.pauseTask(taskId);
    if (action==='resume') return this.resumeTask(taskId); if (action==='checkpoint') { this.checkpoint('manual_checkpoint',taskId); return; }
    if (!this.book.checkpoints.some(c=>!taskId||c.taskId===taskId)) throw new Error('Нет сохранённого checkpoint');
  }
  getRuntime = ():RuntimeSnapshot => {
    const state=this.getSnapshot();
    const members=Object.fromEntries(state.agents.map(agent=>{
      const task=state.tasks.find(t=>t.id===agent.currentTask)??state.tasks.filter(t=>t.assignedAgent===agent.id).at(-1);
      const execution:RuntimeSnapshot['execution']=task?.status==='paused'?'paused':task?.status==='completed'?'completed':task?.status==='failed'?(agent.status==='idle'?'idle':'error'):task&&task.status!=='pending'?'working':'idle';
      const threadId=task?`mock-${agent.id}-${task.id}`:null;
      const events:RuntimeEvent[]=state.activity.filter(e=>e.agentId===agent.id).reverse().map(e=>({id:e.id,method:e.type,message:e.message,timestamp:e.timestamp,source:'mock',agentId:agent.id,taskId:e.taskId,threadId,turnId:null,execution,taskStartedAt:task?.startedAt??null}));
      const runtime:RuntimeSnapshot={projectId:this.projectId,projectContext:this.projectContext,source:'mock',agentId:agent.id,role:agent.role,connection:this.connectedEmployees.has(agent.id)?'connected':'disconnected',execution,version:'Mock · no Codex process',authenticated:false,threadId,turnId:null,skills:agent.skills.filter(s=>s.installationStatus==='installed').map(s=>s.skillId),profile:null,instructionSources:[],contextFiles:[],result:execution==='completed'?'Mock: симуляция завершена; реальный Codex не запускался.':'',plan:[],events,error:execution==='error'?'Mock: ошибка симуляции':null,approval:null,startedAt:task?.startedAt??null,completedAt:task?.completedAt??null,taskId:task?.id??null,pauseReason:task?.pauseReason,checkpoints:this.getCheckpoints().filter(c=>c.agentId===agent.id),savedTasks:this.book.tasks.filter(t=>t.agentId===agent.id),recoveryError:this.recoveryError};
      return [agent.id,runtime];
    }));
    return {...members.lead,members,maxActive:8,activeEmployees:Object.entries(members).filter(([,r])=>r.execution==='working').map(([id])=>id)};
  };
  async action(action:PilotAction,{agentId='lead',taskId,command,projectId}:PilotOptions={}) {if(projectId&&projectId!==this.projectId)throw new Error('Mock project mismatch');
    if(action==='connect_all'){for(const agent of this.getAgents())this.connectedEmployees.add(agent.id);return;}
    if(action==='disconnect_all'){for(const id of [...this.connectedEmployees])await this.action('disconnect',{agentId:id});return;}
    const agent=this.getAgents().find(a=>a.id===agentId);if(!agent)throw new Error('Unknown employee');
    const task=taskId?this.getTasks().find(t=>t.id===taskId):this.getTasks().find(t=>t.id===agent.currentTask);
    if(taskId&&(!task||task.assignedAgent!==agentId))throw new Error('Task belongs to another employee');
    if(action==='connect'){this.connectedEmployees.add(agentId);return;}
    if(action==='disconnect'){if(task&&!['completed','failed','paused'].includes(task.status))this.pauseTask(task.id,'connection_lost');this.connectedEmployees.delete(agentId);return;}
    if(action==='start'){
      if(!this.connectedEmployees.has(agentId))throw new Error('Подключите mock-сессию сотрудника.');
      if(this.getTasks().some(t=>t.assignedAgent===agentId&&!['completed','failed'].includes(t.status)))throw new Error('Employee already has an active task');
      const id=this.dispatch({type:'create',title:`Mock · ${agent.role}`,description:`Изолированная симуляция задачи ${agent.role}. Реальный Codex не используется.`,priority:'normal',actorId:agentId});
      if(!id)throw new Error('Mock task not created');
      this.dispatch({type:'assign',taskId:id,agentId});this.dispatch({type:'transition',taskId:id,status:'in_progress'});
      if(agentId==='qa'||agentId==='review')this.dispatch({type:'transition',taskId:id,status:agentId==='qa'?'testing':'review'});
      this.checkpoint('manual_checkpoint',id);return;
    }
    if(!task)throw new Error('Выберите задачу сотрудника');
    if(action==='control'){await this.controlTask(command??'',task.id);return;}
    if(action==='pause'||action==='interrupt'||action==='mock_limit'){this.pauseTask(task.id,action==='mock_limit'?'limit_reached':'user_pause');return;}
    if(action==='resume'){this.connectedEmployees.add(agentId);this.resumeTask(task.id);return;}
    if(action==='checkpoint'){this.checkpoint('manual_checkpoint',task.id);return;}
    if(action==='mock_error'){this.dispatch({type:'transition',taskId:task.id,status:'failed'});return;}
    if(action==='mock_step'){
      if(task.status==='paused'||['completed','failed'].includes(task.status))throw new Error('Mock task is not running');
      if(task.progress>=75)this.dispatch({type:'transition',taskId:task.id,status:'completed'});
      else if(task.status==='in_progress')this.dispatch({type:'progress',taskId:task.id,progress:task.progress+25});
      else this.dispatch({type:'transition',taskId:task.id,status:'completed'});
      return;
    }
    throw new Error('Unsupported mock action');
  }
  getSnapshot = () => this.system.getSnapshot();
  getAgents = () => this.getSnapshot().agents;
  getTasks = () => this.getSnapshot().tasks;
  getEvents = () => this.getSnapshot().activity;
  subscribeToEvents: CodexAdapter['subscribeToEvents'] = listener => this.system.events.subscribe(listener);
  dispatch = (command: OfficeCommand) => {
    if (['running', 'paused'].includes(this.workflow.getSnapshot().status)) throw new Error('Дождитесь завершения workflow или сбросьте его');
    const safe = command.type==='create'?{ ...command,title:safeText(command.title),description:safeText(command.description) }:command;
    const result = this.system.dispatch(safe); this.finishRecovery(); return result;
  };
  getWorkflow = () => this.workflow.getSnapshot();
  startWorkflow() { this.workflow.start(); }
  advanceWorkflow() { this.workflow.advance(); this.finishRecovery(); }
  private finishRecovery() {
    for (const record of this.book.tasks) {
      const task = this.getTasks().find(t => t.id===record.id); if (!task || !['completed','failed'].includes(task.status)) continue;
      record.status = task.status as 'completed' | 'failed'; record.completedAt = task.completedAt;
      for (const cp of this.book.checkpoints.filter(c => c.taskId===task.id)) { cp.resumable = false; cp.status = task.status==='completed'?'completed':'invalid'; }
    }
    if (this.book.tasks.length) this.save();
  }
  start() { if (this.getTasks().some(t => t.status==='paused')) return; this.workflow.resume(); if (!this.timer) this.timer = setInterval(() => this.advanceWorkflow(), configuration.tickMs); }
  stop() { clearInterval(this.timer); this.timer = undefined; this.workflow.pause(); }
  reset() { this.stop(); this.system.reset(); this.workflow = new MockTeamWorkflow(this.system); this.book=emptyBook('mock'); this.connectedEmployees.clear(); this.recoveryError=null; this.save();this.taskStorage.save([],[]); }
}
