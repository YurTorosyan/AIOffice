import type { OfficeCommand } from '../domain.ts';
import { configuration } from '../config.ts';
import type { CodexAdapter } from './CodexAdapter.ts';
import { TaskSystem } from '../tasks/TaskSystem.ts';
import { MockTeamWorkflow } from './MockTeamWorkflow.ts';
export class MockCodexAdapter implements CodexAdapter {
  readonly source = 'mock' as const;
  private system = new TaskSystem();
  private workflow = new MockTeamWorkflow(this.system);
  private timer: ReturnType<typeof setInterval> | undefined;
  getSnapshot = () => this.system.getSnapshot();
  getAgents = () => this.getSnapshot().agents;
  getTasks = () => this.getSnapshot().tasks;
  getEvents = () => this.getSnapshot().activity;
  subscribeToEvents: CodexAdapter['subscribeToEvents'] = listener => this.system.events.subscribe(listener);
  dispatch = (command: OfficeCommand) => {
    if (['running', 'paused'].includes(this.workflow.getSnapshot().status)) throw new Error('Дождитесь завершения workflow или сбросьте его');
    return this.system.dispatch(command);
  };
  getWorkflow = () => this.workflow.getSnapshot();
  startWorkflow() { this.workflow.start(); }
  advanceWorkflow() { this.workflow.advance(); }
  start() { this.workflow.resume(); if (!this.timer) this.timer = setInterval(() => this.advanceWorkflow(), configuration.tickMs); }
  stop() { clearInterval(this.timer); this.timer = undefined; this.workflow.pause(); }
  reset() { this.stop(); this.system.reset(); this.workflow = new MockTeamWorkflow(this.system); }
}
