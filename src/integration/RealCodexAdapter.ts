import type { ActivityEvent, AgentStatus, OfficeCommand, OfficeState } from '../domain.ts';
import { createOffice } from '../state/office.ts';
import type { CodexAdapter } from './CodexAdapter.ts';
import { LocalBridgeTransport } from './runtime.ts';
import type { PilotAction, RuntimeSnapshot, RuntimeTransport } from './runtime.ts';
export const emptyRuntime = (): RuntimeSnapshot => ({ connection: 'disconnected', execution: 'idle', version: null, authenticated: false, threadId: null, turnId: null, skills: [], profile: null, instructionSources: [], contextFiles: [], result: '', plan: [], events: [], error: null, approval: null, startedAt: null, completedAt: null });
const statusMap: Record<RuntimeSnapshot['execution'], AgentStatus> = { idle: 'idle', starting: 'thinking', working: 'working', waiting: 'waiting', interrupting: 'waiting', completed: 'completed', interrupted: 'idle', error: 'error' };
/** The other seven workers stay untouched. A real turn never advances the mock workflow. */
export function projectRuntime(runtime: RuntimeSnapshot): OfficeState {
  const state = createOffice(), lead = state.agents.find(a => a.id === 'lead')!;
  const taskId = runtime.startedAt ? `pilot-${runtime.startedAt}` : null;
  lead.status = runtime.connection === 'error' ? 'error' : statusMap[runtime.execution];
  lead.currentTask = taskId; lead.startedAt = runtime.startedAt; lead.completedAt = runtime.completedAt;
  lead.lastActivity = runtime.events.at(-1)?.timestamp || null;
  lead.activity = runtime.error || runtime.events.at(-1)?.message || 'Lead Developer · реальный Codex не подключён';
  // Percentage is unknown until Codex confirms completion, never derived from elapsed time or item count.
  lead.progress = runtime.execution === 'completed' ? 100 : 0; lead.progressIndeterminate = !!taskId && runtime.execution !== 'completed';
  if (taskId) state.tasks.push({ id: taskId, title: 'Read-only план AI Office', description: 'Director → Lead Developer · без изменения файлов и без подключения остальных сотрудников', assignedAgent: 'lead', priority: 'normal', status: runtime.execution === 'completed' ? 'completed' : ['error', 'interrupted'].includes(runtime.execution) ? 'failed' : 'in_progress', progress: lead.progress, progressIndeterminate: lead.progressIndeterminate, createdAt: runtime.startedAt!, startedAt: runtime.startedAt, completedAt: runtime.completedAt });
  state.activity = runtime.events.slice(-80).reverse().map(e => ({ id: e.id, type: e.method === 'turn/completed' && e.execution === 'completed' ? 'task_completed' : e.method === 'runtime/error' ? 'task_failed' : 'runtime_event', agentId: 'lead', taskId: e.taskStartedAt ? `pilot-${e.taskStartedAt}` : null, message: `${e.method} · ${e.message}`, timestamp: e.timestamp, status: statusMap[e.execution], source: 'codex', runtimeMethod: e.method }));
  return state;
}
export class RealCodexAdapter implements CodexAdapter {
  readonly source = 'codex' as const;
  private runtime = emptyRuntime(); private listeners = new Set<(event: ActivityEvent) => void>();
  private updateListeners = new Set<() => void>();
  private polling: ReturnType<typeof setTimeout> | undefined; private observing = false; private generation = 0;
  private transport: RuntimeTransport;
  constructor(transport: RuntimeTransport = new LocalBridgeTransport()) { this.transport = transport; }
  getRuntime = () => structuredClone(this.runtime);
  getSnapshot = () => projectRuntime(this.runtime);
  getAgents = () => this.getSnapshot().agents;
  getTasks = () => this.getSnapshot().tasks;
  getEvents = () => this.getSnapshot().activity;
  subscribeToEvents: CodexAdapter['subscribeToEvents'] = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  subscribeToUpdates = (listener: () => void) => { this.updateListeners.add(listener); return () => this.updateListeners.delete(listener); };
  dispatch(_command: OfficeCommand): string | undefined { throw new Error('В Codex pilot доступно только задание Lead на чтение. Для ручных задач выберите mock.'); }
  apply(snapshot: RuntimeSnapshot) {
    const previousIds = new Set(this.runtime.events.map(event => event.id));
    this.runtime = structuredClone(snapshot);
    for (const event of this.getEvents().reverse().filter(event => !previousIds.has(event.id))) {
      for (const listener of this.listeners) listener(structuredClone(event));
    }
    for (const listener of this.updateListeners) listener();
  }
  async action(action: PilotAction) { this.apply(await this.transport.action(action)); }
  async refresh() {
    try { this.apply(await this.transport.snapshot()); }
    catch { this.apply({ ...this.runtime, connection: 'error', error: 'Локальный мост недоступен. Запустите npm run bridge и переподключитесь.' }); }
  }
  observe() {
    this.stopObserving(); this.observing = true; const generation = ++this.generation;
    const poll = async () => { await this.refresh(); if (this.observing && generation === this.generation) this.polling = setTimeout(poll, 800); };
    void poll();
  }
  stopObserving() { this.observing = false; ++this.generation; clearTimeout(this.polling); }
}
