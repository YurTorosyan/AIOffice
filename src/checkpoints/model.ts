import {projectIdentifier} from '../projects/model.ts';
export const pauseReasons = ['user_pause','limit_reached','runtime_interrupted','connection_lost','manual_checkpoint'] as const;
export type PauseReason = typeof pauseReasons[number];
export type CheckpointStatus = 'paused' | 'resumable' | 'resumed' | 'invalid' | 'completed';
export interface RecoveryTask {
  id: string; title: string; description: string; agentId: string; projectId: string;branch?:string|null;
  status: 'in_progress' | 'paused' | 'completed' | 'failed'; createdAt: string; completedAt: string | null;
}
export interface TaskCheckpoint {
  id: string; taskId: string; agentId: string; projectId: string; reason: PauseReason; status: CheckpointStatus;
  workspaceRoot?:string;branch?:string|null; source: 'mock' | 'codex'; taskTitle: string; taskDescription: string; taskStatus: string;
  completedWork: string[]; remainingWork: string[]; importantDecisions: string[];
  relevantFiles: { path: string; sha256: string }[];
  lastKnownState: { execution: string; connection: string; turnId: string | null; startedAt: string;
    plan: { step: string; status: string }[]; workNotes: string[]; stopConfirmed: boolean;
    taskStatus: string; progress: number; workflowStep: number | null; limitCode: string | null; taskPriority?: 'low'|'normal'|'high' };
  codexThreadId: string | null; createdAt: string; resumable: boolean;
}
export interface RecoveryBook { version: 1; source: 'mock' | 'codex'; tasks: RecoveryTask[]; checkpoints: TaskCheckpoint[] }
export interface CheckpointStorage { load(): RecoveryBook; save(book: RecoveryBook): void }
export const emptyBook = (source: 'mock' | 'codex'): RecoveryBook => ({ version: 1, source, tasks: [], checkpoints: [] });
export {safeText} from '../security/redaction.ts';
import {safeText} from '../security/redaction.ts';
const employees = ['lead','design','frontend','backend','seo','security','qa','review'];
function object(value: unknown): asserts value is Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid checkpoint object'); }
function keys(value: Record<string, any>, expected: string[]) { if (Object.keys(value).length !== expected.length || Object.keys(value).some(k => !expected.includes(k))) throw new Error('Unexpected checkpoint fields'); }
function text(value: unknown, max = 10000): asserts value is string { if (typeof value !== 'string' || value.length > max || safeText(value) !== value) throw new Error('Invalid or sensitive checkpoint text'); }
function id(value: unknown) { text(value, 160); if (!/^[a-zA-Z0-9_.:-]+$/.test(value as string)) throw new Error('Invalid checkpoint identifier'); }
function date(value: unknown) { text(value, 40); if (!Number.isFinite(Date.parse(value as string))) throw new Error('Invalid checkpoint date'); }
function strings(value: unknown) { if (!Array.isArray(value) || value.length > 100) throw new Error('Invalid checkpoint list'); value.forEach(v => text(v)); }
export function validateCheckpoint(value: unknown, source: 'mock' | 'codex'): TaskCheckpoint {
  object(value); keys(value, ['id','taskId','agentId','projectId','reason','status','source','taskTitle','taskDescription','taskStatus','completedWork','remainingWork','importantDecisions','relevantFiles','lastKnownState','codexThreadId','createdAt','resumable',...(Object.hasOwn(value,'workspaceRoot')?['workspaceRoot']:[]),...(Object.hasOwn(value,'branch')?['branch']:[])]);if(value.branch!==undefined&&value.branch!==null)text(value.branch,200);
  id(value.id); id(value.taskId);projectIdentifier(value.projectId);if(value.workspaceRoot!==undefined)text(value.workspaceRoot,500); if (!employees.includes(value.agentId) || value.source !== source) throw new Error('Wrong checkpoint assignment');
  if (!pauseReasons.includes(value.reason) || !['paused','resumable','resumed','invalid','completed'].includes(value.status) || typeof value.resumable !== 'boolean' || (value.resumable && !['paused','resumable'].includes(value.status))) throw new Error('Invalid checkpoint status');
  for (const field of ['taskTitle','taskDescription','taskStatus']) text(value[field]);
  if (!['pending','in_progress','review','testing','paused','completed','failed'].includes(value.taskStatus)) throw new Error('Invalid checkpoint task status');
  if (!value.taskDescription.trim()) throw new Error('Checkpoint task has no context');
  for (const field of ['completedWork','remainingWork','importantDecisions']) strings(value[field]);
  if (value.codexThreadId !== null) id(value.codexThreadId); date(value.createdAt);
  if (!Array.isArray(value.relevantFiles) || value.relevantFiles.length > 40) throw new Error('Invalid relevant files');
  value.relevantFiles.forEach((file: unknown) => { object(file); keys(file,['path','sha256']); text(file.path,300); if (/^(?:[a-z]:|\/|\\)|(?:^|[\\/])\.\.(?:[\\/]|$)|(?:\.env|auth\.json|credentials)/i.test(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Unsafe checkpoint file'); });
  const state = value.lastKnownState; object(state); keys(state,['execution','connection','turnId','startedAt','plan','workNotes','stopConfirmed','taskStatus','progress','workflowStep','limitCode',...(Object.hasOwn(state,'taskPriority')?['taskPriority']:[])]);
  if(Object.hasOwn(state,'taskPriority')&&!['low','normal','high'].includes(state.taskPriority))throw new Error('Invalid checkpoint priority');
  for (const field of ['execution','connection','taskStatus']) text(state[field],80);
  if (!['idle','starting','working','waiting','interrupting','pausing','resuming','paused','interrupted','error','completed','pending','in_progress','review','testing','failed'].includes(state.execution) || !['mock','connected','connecting','disconnected','error'].includes(state.connection)) throw new Error('Invalid checkpoint runtime state');
  if (!['pending','in_progress','review','testing'].includes(state.taskStatus) || ![null,'usageLimitExceeded','sessionBudgetExceeded','contextWindowExceeded','http429'].includes(state.limitCode)) throw new Error('Invalid recovery continuation state');
  if (state.turnId !== null) id(state.turnId); date(state.startedAt); strings(state.workNotes);
  if (typeof state.stopConfirmed !== 'boolean' || !Number.isFinite(state.progress) || state.progress < 0 || state.progress > 100 || (state.workflowStep !== null && (!Number.isInteger(state.workflowStep) || state.workflowStep < 0 || state.workflowStep > 8))) throw new Error('Invalid checkpoint state');
  if (!Array.isArray(state.plan) || state.plan.length > 100) throw new Error('Invalid plan');
  state.plan.forEach((step: unknown) => { object(step); keys(step,['step','status']); text(step.step); if (!['pending','inProgress','completed'].includes(step.status)) throw new Error('Invalid plan status'); });
  return structuredClone(value) as TaskCheckpoint;
}
export function validateBook(value: unknown, source: 'mock' | 'codex'): RecoveryBook {
  object(value); keys(value,['version','source','tasks','checkpoints']);
  if (value.version !== 1 || value.source !== source || !Array.isArray(value.tasks) || !Array.isArray(value.checkpoints) || value.tasks.length > 100 || value.checkpoints.length > 500) throw new Error('Invalid recovery file');
  const tasks = value.tasks.map((task: unknown) => { object(task); keys(task,['id','title','description','agentId','projectId','status','createdAt','completedAt',...(Object.hasOwn(task,'branch')?['branch']:[])]);if(task.branch!==undefined&&task.branch!==null)text(task.branch,200);id(task.id);projectIdentifier(task.projectId); text(task.title); text(task.description); date(task.createdAt); if (task.completedAt !== null) date(task.completedAt);
    if (!employees.includes(task.agentId) || !['in_progress','paused','completed','failed'].includes(task.status)) throw new Error('Invalid recovery task'); return task as RecoveryTask; });
  const checkpoints = value.checkpoints.map((c: unknown) => validateCheckpoint(c,source));
  if (new Set(tasks.map((t: RecoveryTask) => t.id)).size !== tasks.length || new Set(checkpoints.map((c: TaskCheckpoint) => c.id)).size !== checkpoints.length) throw new Error('Duplicate recovery identifiers');
  for (const c of checkpoints) { const task = tasks.find((t: RecoveryTask) => t.id === c.taskId); if (!task || task.agentId !== c.agentId || task.projectId!==c.projectId || task.description !== c.taskDescription || (c.resumable && ['completed','failed'].includes(task.status))) throw new Error('Checkpoint task missing or mismatched'); }
  const owners=new Map<string,string>();
  for(const cp of checkpoints){if(cp.codexThreadId){const owner=owners.get(cp.codexThreadId);if(owner&&owner!==cp.agentId)throw new Error('Codex thread shared between employees');owners.set(cp.codexThreadId,cp.agentId);}}
  return structuredClone({ version: 1, source, tasks, checkpoints });
}
export function latestCheckpoint(book: RecoveryBook, taskId?: string): TaskCheckpoint {
  const eligible = book.tasks.filter(task => task.status === 'paused').map(task => [...book.checkpoints].reverse().find(c => c.taskId === task.id)).filter((c): c is TaskCheckpoint => !!c && c.resumable && ['paused','resumable'].includes(c.status) && (!taskId || c.taskId === taskId));
  if (eligible.length !== 1) throw new Error(eligible.length ? 'Выберите задачу: доступно несколько контрольных точек' : 'Нет задачи для возобновления');
  return validateCheckpoint(eligible[0],book.source);
}
export function resolveControl(command: string): 'pause' | 'resume' | 'checkpoint' | 'show' {
  const normalized = command.trim().toLowerCase();
  if (['пауза','pause'].includes(normalized)) return 'pause';
  if (['продолжим работу','продолжить','resume'].includes(normalized)) return 'resume';
  if (['сохранить checkpoint','checkpoint'].includes(normalized)) return 'checkpoint';
  if (['показать checkpoint','где остановились','show checkpoint'].includes(normalized)) return 'show';
  throw new Error('Используйте: Пауза, Продолжим работу, Показать checkpoint, Где остановились');
}
export class MemoryCheckpointStorage implements CheckpointStorage {
  private book: RecoveryBook;
  constructor(source: 'mock' | 'codex' = 'mock') { this.book = emptyBook(source); }
  load() { return structuredClone(this.book); }
  save(book: RecoveryBook) { this.book = validateBook(book,book.source); }
}
