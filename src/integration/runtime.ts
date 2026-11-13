/** AI Office public bridge contract, NOT the Codex wire protocol. No credentials/raw RPC cross this boundary. */
export interface RuntimeEvent { id: string; method: string; message: string; timestamp: string; source: 'codex'; threadId: string | null; turnId: string | null; execution: RuntimeSnapshot['execution']; taskStartedAt: string | null }
export interface RuntimeSnapshot {
  connection: 'disconnected' | 'connecting' | 'connected' | 'error';
  execution: 'idle' | 'starting' | 'working' | 'waiting' | 'interrupting' | 'completed' | 'interrupted' | 'error';
  version: string | null; authenticated: boolean; threadId: string | null; turnId: string | null;
  skills: string[]; profile: { path: string; sha256: string; mode: string } | null; instructionSources: string[];
  contextFiles: { path: string; sha256: string }[];
  result: string; plan: { step: string; status: string }[]; events: RuntimeEvent[];
  error: string | null; approval: { method: string; message: string } | null; startedAt: string | null; completedAt: string | null;
}
export type PilotAction = 'connect' | 'start' | 'interrupt' | 'reject' | 'disconnect';
export interface RuntimeTransport { snapshot(): Promise<RuntimeSnapshot>; action(action: PilotAction): Promise<RuntimeSnapshot> }
export class LocalBridgeTransport implements RuntimeTransport {
  private token: string | null = null;
  private request: typeof fetch;
  constructor(request: typeof fetch = (...args) => fetch(...args)) { this.request = request; }
  async snapshot() {
    const response = await this.request('/api/codex/snapshot');
    if (!response.ok) throw new Error('Локальный мост недоступен. Запустите npm run bridge.');
    return await response.json() as RuntimeSnapshot;
  }
  async action(action: PilotAction) {
    if (!this.token) {
      const session = await this.request('/api/codex/session');
      if (!session.ok) throw new Error('Локальный мост недоступен. Запустите npm run bridge.');
      this.token = (await session.json()).token;
    }
    const response = await this.request('/api/codex/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AI-Office-Token': this.token! }, body: JSON.stringify({ action }) });
    if (response.status === 403) this.token = null;
    const body = await response.json();
    if (!response.ok) { if (body.snapshot) return body.snapshot as RuntimeSnapshot; throw new Error('Мост отклонил запрос. Переподключитесь.'); }
    return body as RuntimeSnapshot;
  }
}
