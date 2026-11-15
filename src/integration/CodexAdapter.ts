import type { ActivityEvent, Agent, OfficeCommand, OfficeState, Task } from '../domain.ts';
import type { TaskCheckpoint } from '../checkpoints/model.ts';
// AI Office's own contract; not a Codex wire API. Both adapters preserve this interface.
export interface CodexAdapter {
  readonly source: 'mock' | 'codex';
  getAgents(): Agent[]; getTasks(): Task[]; getEvents(): ActivityEvent[]; getSnapshot(): OfficeState;
  subscribeToEvents(listener: (event: ActivityEvent) => void): () => void;
  dispatch(command: OfficeCommand): string | undefined;
  getCheckpoints(): TaskCheckpoint[];
  controlTask(command: string, taskId?: string): void | Promise<void>;
}
