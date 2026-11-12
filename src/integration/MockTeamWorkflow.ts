import type { OfficeCommand } from '../domain.ts';
import type { TaskSystem } from '../tasks/TaskSystem.ts';
export interface WorkflowState { status: 'ready' | 'running' | 'paused' | 'completed' | 'error'; step: number; total: number; label: string; error: string | null }
export class MockTeamWorkflow {
  private system: TaskSystem;
  private taskId: string | null = null;
  private state: WorkflowState = { status: 'ready', step: 0, total: 8, label: 'Готов к запуску', error: null };
  constructor(system: TaskSystem) { this.system = system; }
  getSnapshot(): WorkflowState { return { ...this.state }; }
  start() {
    if (['running', 'paused'].includes(this.state.status)) throw new Error('Workflow уже запущен');
    if (this.system.getSnapshot().tasks.some(t => ['frontend', 'qa', 'review', 'lead'].includes(t.assignedAgent ?? '') && !['completed', 'failed'].includes(t.status))) throw new Error('Освободите участников workflow или сбросьте демонстрацию');
    this.taskId = this.system.dispatch({ type: 'create', title: 'Собрать и проверить Task Panel', description: 'Mock workflow: Lead → Frontend → QA → независимый Reviewer → Lead. Без реального Codex.', priority: 'high', actorId: 'lead' })!;
    this.state = { status: 'running', step: 0, total: 8, label: 'Lead Developer создал задачу', error: null };
  }
  advance() {
    if (this.state.status !== 'running' || !this.taskId) return;
    const taskId = this.taskId;
    const steps: { label: string; command: OfficeCommand }[] = [
      { label: 'Frontend получил задачу', command: { type: 'assign', taskId, agentId: 'frontend' } },
      { label: 'Frontend приступил к выполнению', command: { type: 'transition', taskId, status: 'in_progress' } },
      { label: 'Frontend: выполнено 35%', command: { type: 'progress', taskId, progress: 35 } },
      { label: 'Frontend: выполнено 75%', command: { type: 'progress', taskId, progress: 75 } },
      { label: 'QA Engineer тестирует результат', command: { type: 'transition', taskId, status: 'testing' } },
      { label: 'Technical Reviewer проводит независимое ревью', command: { type: 'transition', taskId, status: 'review' } },
      { label: 'Lead Developer получил результат', command: { type: 'assign', taskId, agentId: 'lead' } },
      { label: 'Задача завершена', command: { type: 'transition', taskId, status: 'completed' } },
    ];
    try {
      const step = steps[this.state.step]; this.system.dispatch(step.command);
      this.state = { ...this.state, step: this.state.step + 1, label: step.label, status: this.state.step + 1 === steps.length ? 'completed' : 'running' };
    } catch (error) { this.state = { ...this.state, status: 'error', error: error instanceof Error ? error.message : String(error), label: 'Workflow остановлен' }; }
  }
  pause() { if (this.state.status === 'running') this.state = { ...this.state, status: 'paused' }; }
  resume() { if (this.state.status === 'paused') this.state = { ...this.state, status: 'running' }; }
}
