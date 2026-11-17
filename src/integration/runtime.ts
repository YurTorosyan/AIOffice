/** AI Office public bridge contract, NOT the Codex wire protocol. No credentials/raw RPC cross this boundary. */
export interface RuntimeEvent { projectId?:string;branch?:string|null; id: string; method: string; message: string; timestamp: string; source: 'codex'|'mock'; taskId?:string|null; agentId?:string; origin?:'runtime'|'bridge';threadId: string | null; turnId: string | null; execution: RuntimeSnapshot['execution']; taskStartedAt: string | null }
export interface RuntimeSnapshot {resources?:ReturnType<import('../resources/ResourceOrchestrator.ts').ResourceOrchestrator['snapshot']>;resourceDecision?:import('../resources/policy.ts').ResourceDecision; projectId?:string;projectContext?:import('../projects/model.ts').ProjectContext;
  source?:'mock'|'codex'; agentId?:string; role?:string; members?:Record<string,RuntimeSnapshot>; maxActive?:number; activeEmployees?:string[]; teamError?:string|null;
  connection: 'disconnected' | 'connecting' | 'connected' | 'error';
  execution: 'idle' | 'starting' | 'working' | 'waiting' | 'interrupting' | 'pausing' | 'paused' | 'resuming' | 'completed' | 'interrupted' | 'error';
  checkpoints?: TaskCheckpoint[]; savedTasks?: RecoveryTask[]; taskId?: string | null; pauseReason?: string | null; resumeMode?: string | null; recoveryError?: string | null;
  version: string | null; authenticated: boolean; threadId: string | null; turnId: string | null;
  skills: string[]; profile: { path: string; sha256: string; mode: string } | null; instructionSources: string[];
  contextFiles: { path: string; sha256: string }[];
  result: string; plan: { step: string; status: string }[]; events: RuntimeEvent[];
  error: string | null; approval: { method: string; message: string } | null; startedAt: string | null; completedAt: string | null;
}
export type PilotAction = 'connect' | 'start' | 'interrupt' | 'reject' | 'disconnect' | 'pause' | 'resume' | 'checkpoint' | 'control' | 'connect_all' | 'disconnect_all' | 'mock_step' | 'mock_error' | 'mock_limit';
export interface PilotOptions { projectId?:string; agentId?:string; taskId?: string; command?: string }
export interface RuntimeTransport {abortPolling?():void; snapshot(): Promise<RuntimeSnapshot>; action(action: PilotAction, options?: PilotOptions): Promise<RuntimeSnapshot> }
export class LocalBridgeTransport implements RuntimeTransport {
  private token: string | null = null;private snapshotController:AbortController|null=null;
  abortPolling(){this.snapshotController?.abort();}
  private request: typeof fetch;private projectId:string;
  constructor(request: typeof fetch = (...args) => fetch(...args),projectId='office-demo') { this.request = request;this.projectId=projectId; }
  async snapshot() {
    this.snapshotController=new AbortController();const response = await this.request('/api/codex/snapshot?projectId='+encodeURIComponent(this.projectId),{signal:this.snapshotController.signal});
    if (!response.ok) throw new Error('Локальный мост недоступен. Запустите npm run bridge.');
    return await response.json() as RuntimeSnapshot;
  }
  async action(action: PilotAction, options: PilotOptions = {}) {
    if (!this.token) {
      const session = await this.request('/api/codex/session');
      if (!session.ok) throw new Error('Локальный мост недоступен. Запустите npm run bridge.');
      this.token = (await session.json()).token;
    }
    const response = await this.request('/api/codex/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AI-Office-Token': this.token! }, body: JSON.stringify({ action, ...options,projectId:this.projectId }) });
    if (response.status === 403) this.token = null;
    const body = await response.json();
    if (!response.ok) { if (body.snapshot) return { ...body.snapshot,error:body.snapshot.error || body.error } as RuntimeSnapshot; throw new Error('Мост отклонил запрос. Переподключитесь.'); }
    return body as RuntimeSnapshot;
  }
}
import type { TaskCheckpoint, RecoveryTask } from '../checkpoints/model.ts';
