import type {ProjectContext} from '../projects/model.ts';
import type { ActivityEvent, AgentStatus, OfficeCommand, OfficeState } from '../domain.ts';
import { createOffice } from '../state/office.ts';
import type { CodexAdapter } from './CodexAdapter.ts';
import { LocalBridgeTransport } from './runtime.ts';
import type { PilotAction, PilotOptions, RuntimeSnapshot, RuntimeTransport } from './runtime.ts';
export const emptyRuntime = (): RuntimeSnapshot => ({ connection: 'disconnected', execution: 'idle', version: null, authenticated: false, threadId: null, turnId: null, skills: [], profile: null, instructionSources: [], contextFiles: [], result: '', plan: [], events: [], error: null, approval: null, startedAt: null, completedAt: null });
const statusMap: Record<RuntimeSnapshot['execution'], AgentStatus> = { idle: 'idle', starting: 'thinking', working: 'working', waiting: 'waiting', interrupting: 'waiting', pausing:'waiting',paused:'waiting',resuming:'thinking',completed: 'completed', interrupted: 'idle', error: 'error' };
/** One owned runtime projection. A legacy snapshot without members still projects only Lead. */
function projectOneRuntime(runtime: RuntimeSnapshot, agentId='lead'): OfficeState {
  const state = createOffice(runtime.projectId??'office-demo'), lead = state.agents.find(a => a.id === agentId)!;
  const taskId = runtime.taskId ?? (runtime.startedAt ? `pilot-${runtime.startedAt}` : null);
  lead.status = runtime.execution==='paused'?'waiting':runtime.connection === 'error' ? 'error' : statusMap[runtime.execution];
  lead.currentTask = taskId; lead.startedAt = runtime.startedAt; lead.completedAt = runtime.completedAt;
  lead.lastActivity = runtime.events.at(-1)?.timestamp || null;
  lead.activity = runtime.error || runtime.events.at(-1)?.message || `${lead.role} · реальный Codex не подключён`;
  // Percentage is unknown until Codex confirms completion, never derived from elapsed time or item count.
  lead.progress = runtime.execution === 'completed' ? 100 : 0; lead.progressIndeterminate = !!taskId && runtime.execution !== 'completed';
  if (taskId) state.tasks.push({ projectId:runtime.projectId??'office-demo',id: taskId, title: runtime.savedTasks?.find(t=>t.id===taskId)?.title??(agentId==='lead'?'Read-only план AI Office':`${lead.role} · Read-only анализ`), description: `Director → ${lead.role} · анализ разрешённых снимков проекта. Только чтение, без изменения файлов.`, assignedAgent: agentId, priority: 'normal', status: runtime.execution==='paused'?'paused':runtime.execution === 'completed' ? 'completed' : ['error', 'interrupted'].includes(runtime.execution) ? 'failed' : 'in_progress', progress: lead.progress, progressIndeterminate: lead.progressIndeterminate, createdAt: runtime.startedAt!, startedAt: runtime.startedAt, completedAt: runtime.completedAt,pauseReason:runtime.pauseReason ?? undefined });
  for (const saved of runtime.savedTasks ?? []) if (saved.id!==taskId&&saved.projectId===(runtime.projectId??'office-demo')) state.tasks.push({ projectId:saved.projectId,id:saved.id,title:saved.title,description:`${state.agents.find(a=>a.id===saved.agentId)?.role??saved.agentId} · сохранённое read-only задание`,assignedAgent:saved.agentId,priority:'normal',status:saved.status,progress:saved.status==='completed'?100:0,progressIndeterminate:saved.status!=='completed',createdAt:saved.createdAt,startedAt:saved.createdAt,completedAt:saved.completedAt });
  const recoveryEvents = ['task_pause_requested','task_paused','task_paused_limit','checkpoint_created','task_resume_requested','task_resumed','checkpoint_restored','resume_failed'] as const;
  state.activity = runtime.events.slice(-80).reverse().map(e => ({projectId:runtime.projectId??'office-demo',branch:e.branch??null,id: e.id, type: recoveryEvents.includes(e.method as typeof recoveryEvents[number])?e.method as typeof recoveryEvents[number]:e.method === 'turn/completed' && e.execution === 'completed' ? 'task_completed' : e.method === 'runtime/error' && e.execution!=='paused' ? 'task_failed' : 'runtime_event', agentId, taskId: e.taskId ?? (e.taskStartedAt ? `pilot-${e.taskStartedAt}` : null), message: `${e.method} · ${e.method==='thread/started'?`Read-only thread confirmed; ${lead.role} profile supplied as developer instructions`:e.message}`, timestamp: e.timestamp, status: statusMap[e.execution], source: 'codex', runtimeMethod: e.method }));
  return state;
}
export function projectRuntime(runtime:RuntimeSnapshot):OfficeState {
 if(!runtime.members)return projectOneRuntime(runtime);
 const state=createOffice(runtime.projectId??'office-demo');
 for(const employee of state.agents){const member=runtime.members[employee.id];if(!member)continue;
  if(member.agentId&&member.agentId!==employee.id||(member.projectId??'office-demo')!==(runtime.projectId??'office-demo')){employee.status='error';employee.activity='Неверная привязка runtime';continue;}
  const part=projectOneRuntime({...member,projectContext:member.projectContext??runtime.projectContext},employee.id);Object.assign(employee,part.agents.find(a=>a.id===employee.id));state.tasks.push(...part.tasks);state.activity.push(...part.activity);
 }
 state.activity.sort((a,b)=>b.timestamp.localeCompare(a.timestamp));state.activity=state.activity.slice(0,80);return state;
}
export class RealCodexAdapter implements CodexAdapter {
  readonly source = 'codex' as const;
  private runtime = emptyRuntime(); private listeners = new Set<(event: ActivityEvent) => void>();
  private updateListeners = new Set<() => void>();
  private polling: ReturnType<typeof setTimeout> | undefined; private observing = false; private generation = 0;
  private transport: RuntimeTransport;
  private projectId:string;
  constructor(transport?:RuntimeTransport,context?:ProjectContext) {this.projectId=context?.projectId??'office-demo';this.runtime={...emptyRuntime(),projectId:this.projectId,projectContext:context};this.transport=transport??new LocalBridgeTransport(undefined,this.projectId);}
  getRuntime = () => structuredClone(this.runtime);
  getSnapshot = () => projectRuntime(this.runtime);
  getAgents = () => this.getSnapshot().agents;
  getTasks = () => this.getSnapshot().tasks;
  getEvents = () => this.getSnapshot().activity;
  getCheckpoints = () => structuredClone(this.runtime.members?Object.values(this.runtime.members).flatMap(r=>r.checkpoints??[]):this.runtime.checkpoints??[]);
  async controlTask(command: string,taskId?: string) { const agentId=this.getTasks().find(t=>t.id===taskId)?.assignedAgent??'lead'; await this.action('control',{command,taskId,agentId}); }
  subscribeToEvents: CodexAdapter['subscribeToEvents'] = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  subscribeToUpdates = (listener: () => void) => { this.updateListeners.add(listener); return () => this.updateListeners.delete(listener); };
  dispatch(_command: OfficeCommand): string | undefined { throw new Error('В Codex pilot доступны read-only задания всех восьми сотрудников. Для ручных задач выберите mock.'); }
  apply(snapshot: RuntimeSnapshot) {if((snapshot.projectId??'office-demo')!==this.projectId)throw new Error('Runtime project mismatch');
    const previousIds = new Set(this.getEvents().map(event => event.id));
    this.runtime = structuredClone(snapshot);
    for (const event of this.getEvents().reverse().filter(event => !previousIds.has(event.id))) {
      for (const listener of this.listeners) listener(structuredClone(event));
    }
    for (const listener of this.updateListeners) listener();
  }
  async action(action: PilotAction,options?: PilotOptions) { this.apply(await this.transport.action(action,options)); }
  async refresh() {
    try { this.apply(await this.transport.snapshot()); }
    catch { this.apply({ ...this.runtime, ...(this.runtime.members?{members:Object.fromEntries(Object.entries(this.runtime.members).map(([id,r])=>[id,{...r,connection:'error' as const,error:'Локальный мост недоступен; состояние требует переподключения.'}]))}:{}), connection: 'error', error: 'Локальный мост недоступен. Запустите npm run bridge и переподключитесь.' }); }
  }
  observe() {
    this.stopObserving(); this.observing = true; const generation = ++this.generation;
    const poll = async () => { await this.refresh(); if (this.observing && generation === this.generation) this.polling = setTimeout(poll, 800); };
    void poll();
  }
  stopObserving() { this.observing = false; ++this.generation; clearTimeout(this.polling); }
}
