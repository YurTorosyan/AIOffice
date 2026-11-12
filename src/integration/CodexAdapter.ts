import type { ActivityEvent, Agent, OfficeCommand, OfficeState, Task } from '../domain.ts';
// AI Office's own contract; not a Codex API. No real implementation in stage 2.
export interface CodexAdapter {
  readonly source: 'mock' | 'codex';
  getAgents(): Agent[]; getTasks(): Task[]; getEvents(): ActivityEvent[]; getSnapshot(): OfficeState;
  subscribeToEvents(listener: (event: ActivityEvent) => void): () => void;
  dispatch(command: OfficeCommand): string | undefined;
}
