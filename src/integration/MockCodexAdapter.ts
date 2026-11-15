import type { OfficeCommand, Task, TaskStatus, EventType } from '../domain.ts';
import { emptyBook, latestCheckpoint, validateBook, resolveControl, safeText, MemoryCheckpointStorage, type CheckpointStorage, type RecoveryBook, type TaskCheckpoint, type PauseReason } from '../checkpoints/model.ts';
import { BrowserCheckpointStorage } from '../checkpoints/browser.ts';
import { configuration } from '../config.ts';
import type { CodexAdapter } from './CodexAdapter.ts';
import { TaskSystem } from '../tasks/TaskSystem.ts';
import { MockTeamWorkflow } from './MockTeamWorkflow.ts';
export class MockCodexAdapter implements CodexAdapter {
  readonly source = 'mock' as const;
  private system = new TaskSystem();
  private workflow = new MockTeamWorkflow(this.system);
  private timer: ReturnType<typeof setInterval> | undefined;
  private storage: CheckpointStorage; private book: RecoveryBook = emptyBook('mock'); private recoveryError: string | null = null;
  constructor(storage: CheckpointStorage = typeof window === 'undefined'?new MemoryCheckpointStorage():new BrowserCheckpointStorage()) {
    this.storage = storage;
    try {
      this.book = validateBook(storage.load(),'mock'); const task=[...this.book.tasks].reverse().find(t=>['paused','in_progress'].includes(t.status));
      const cp=task?[...this.book.checkpoints].reverse().find(c=>c.taskId===task.id):undefined;
      if (cp&&task) { if(!cp.resumable){cp.resumable=true;cp.status='resumable';cp.reason='connection_lost';cp.lastKnownState.stopConfirmed=true;task.status='paused';}this.restore(cp);this.save(); }
    }
    catch { this.recoveryError = 'Mock checkpoint повреждён или недоступен. Исходные данные не перезаписаны.'; }
  }
  getCheckpoints = () => structuredClone(this.book.checkpoints);
  getRecoveryError = () => this.recoveryError;
  private save() { this.storage.save(this.book); }
  private log(type: EventType,taskId: string,text: string) { this.system.recordRecovery(type,taskId,`mock · ${text}`); }
  private restore(cp: TaskCheckpoint) {
    const task: Task = { id:cp.taskId,title:cp.taskTitle,description:cp.taskDescription,status:'paused',assignedAgent:cp.agentId,priority:cp.lastKnownState.taskPriority??'normal',progress:cp.lastKnownState.progress,
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
    const row = { id:task.id,title:safeText(task.title),description,agentId,projectId:'office-demo' as const,status:task.status==='paused'?'paused' as const:'in_progress' as const,createdAt:task.createdAt,completedAt:null };
    if (record) Object.assign(record,row); else this.book.tasks.push(row);
    const workflow = this.workflow.getRecovery(); const step = workflow.taskId === task.id ? workflow.step : null;
    const cp: TaskCheckpoint = { id:crypto.randomUUID(),taskId:task.id,agentId,projectId:'office-demo',source:'mock',reason,status:task.status==='paused'?'resumable':'paused',
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
  reset() { this.stop(); this.system.reset(); this.workflow = new MockTeamWorkflow(this.system); this.book=emptyBook('mock'); this.recoveryError=null; this.save(); }
}
