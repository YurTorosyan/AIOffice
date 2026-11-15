import { configuration } from '../config.ts';
import { statuses, taskStatuses, type ActivityEvent, type Agent, type AgentStatus, type EventType, type OfficeCommand, type OfficeState, type Task, type TaskStatus } from '../domain.ts';
import { EventBus } from '../events/EventBus.ts';
import { releaseAgent, statusActivity, syncAgent, taskAgentStatus } from '../state/agents.ts';
import { createOffice } from '../state/office.ts';
export const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['in_progress', 'failed'], in_progress: ['review', 'testing', 'completed', 'failed'],
  review: ['in_progress', 'testing', 'completed', 'failed'], testing: ['in_progress', 'review', 'completed', 'failed'], paused: [], completed: [], failed: [],
};
export function isActive(task: Task) { return task.status !== 'completed' && task.status !== 'failed'; }
export class TaskSystem {
  private state = createOffice();
  readonly events = new EventBus();
  getSnapshot = (): OfficeState => structuredClone(this.state);
  reset() { this.state = createOffice(); }
  /** Called only with validated recovery data; profile metadata always comes from the current registry. */
  restoreTask(task: Task) {
    const previous = this.state.tasks.findIndex(t => t.id === task.id);
    if (previous < 0) this.state.tasks.push(structuredClone(task)); else this.state.tasks[previous] = structuredClone(task);
    for (const agent of this.state.agents) {
      if (agent.id === task.assignedAgent) Object.assign(agent,syncAgent(agent,task,new Date().toISOString()));
      else if (agent.currentTask === task.id) Object.assign(agent,releaseAgent(agent,new Date().toISOString()));
    }
  }
  recordRecovery(type: EventType,taskId: string,message: string) {
    const task = this.state.tasks.find(t => t.id === taskId); const agent = this.state.agents.find(a => a.id === (task?.assignedAgent ?? 'lead'))!;
    const event: ActivityEvent = { id:crypto.randomUUID(),type,taskId,agentId:agent.id,message,timestamp:new Date().toISOString(),status:agent.status,source:'mock' };
    this.state.activity = [event,...this.state.activity].slice(0,configuration.activityLimit); this.events.publish([event]);
  }
  dispatch(command: OfficeCommand, now = new Date().toISOString()): string | undefined {
    if (!Number.isFinite(Date.parse(now))) throw new Error('Некорректная дата события');
    const next = this.getSnapshot();
    const events: ActivityEvent[] = [];
    const agentById = (id: string) => { const agent = next.agents.find(a => a.id === id); if (!agent) throw new Error('Сотрудник не найден'); return agent; };
    const emit = (type: EventType, agent: Agent, task: Task | null, text: string) => {
      events.push({ id: crypto.randomUUID(), type, agentId: agent.id, taskId: task?.id ?? null, message: `${agent.role} · ${text}`, timestamp: now, status: agent.status, source: 'mock' });
    };
    const updateAgent = (updated: Agent, task: Task | null) => {
      const previous = agentById(updated.id);
      const changed = previous.status !== updated.status || previous.currentTask !== updated.currentTask;
      Object.assign(agentById(updated.id), updated);
      if (changed) emit('agent_status_changed', updated, task, updated.activity);
    };
    const ensureFree = (id: string, taskId: string) => {
      agentById(id);
      if (next.tasks.some(t => t.id !== taskId && t.assignedAgent === id && isActive(t))) throw new Error('У сотрудника уже есть активная задача');
    };
    const assign = (task: Task, id: string) => {
      if (task.status === 'testing' && id !== 'qa') throw new Error('Тестирование выполняет QA Engineer');
      ensureFree(id, task.id);
      if (task.assignedAgent && task.assignedAgent !== id) updateAgent(releaseAgent(agentById(task.assignedAgent), now), task);
      task.assignedAgent = id;
      updateAgent(syncAgent(agentById(id), task, now), task);
      emit('task_assigned', agentById(id), task, `получил задачу «${task.title}»`);
    };
    let result: string | undefined;
    if (command.type === 'create') {
      if (!command.title.trim()) throw new Error('Введите название задачи');
      if (!['low', 'normal', 'high'].includes(command.priority)) throw new Error('Некорректный приоритет');
      const creator = agentById(command.actorId ?? 'lead');
      const task: Task = { id: crypto.randomUUID(), title: command.title.trim(), description: command.description.trim(), priority: command.priority, progress: 0, status: 'pending', assignedAgent: null, createdAt: now, startedAt: null, completedAt: null };
      next.tasks.push(task); result = task.id;
      creator.lastActivity = now; creator.activity = `Создал задачу «${task.title}»`;
      emit('task_created', creator, task, creator.activity);
    } else if (command.type === 'agent_status') {
      const agent = agentById(command.agentId);
      if (!statuses.includes(command.status)) throw new Error('Неизвестный статус сотрудника');
      const task = next.tasks.find(t => t.id === agent.currentTask && isActive(t));
      const allowed: AgentStatus[] = task ? [taskAgentStatus[task.status], ...(task.status === 'in_progress' ? ['thinking', 'waiting'] as const : [])] : ['idle', 'thinking', 'waiting'];
      if (!allowed.includes(command.status)) throw new Error('Этот статус управляется задачей');
      updateAgent({ ...agent, status: command.status, activity: command.activity ?? statusActivity[command.status], lastActivity: now }, task ?? null);
    } else {
      const task = next.tasks.find(t => t.id === command.taskId);
      if (!task) throw new Error('Задача не найдена');
      if (!isActive(task)) throw new Error('Завершённую задачу нельзя изменять');
      if (task.status === 'paused') throw new Error('Сначала возобновите задачу из checkpoint');
      if (command.type === 'assign') assign(task, command.agentId);
      else if (command.type === 'progress') {
        if (task.status !== 'in_progress') throw new Error('Прогресс доступен только во время выполнения');
        if (!Number.isFinite(command.progress) || command.progress < task.progress || command.progress >= 100) throw new Error('Прогресс должен возрастать и быть меньше 100');
        task.progress = command.progress;
        const agent = agentById(task.assignedAgent!);
        updateAgent(syncAgent(agent, task, now), task);
        emit('task_progress', agent, task, `${task.title}: ${task.progress}%`);
      } else {
        if (!taskStatuses.includes(command.status) || !transitions[task.status].includes(command.status)) throw new Error('Недопустимый переход задачи');
        const target = command.agentId ?? (command.status === 'testing' ? 'qa' : command.status === 'review' ? 'review' : task.assignedAgent);
        if (!target) throw new Error('Сначала назначьте исполнителя');
        if (command.status === 'testing' && target !== 'qa') throw new Error('Тестирование выполняет QA Engineer');
        ensureFree(target, task.id);
        task.status = command.status;
        if (command.status === 'in_progress') task.startedAt ??= now;
        task.completedAt = ['completed', 'failed'].includes(command.status) ? now : null;
        if (command.status === 'completed') task.progress = 100;
        if (task.assignedAgent !== target) assign(task, target);
        else updateAgent(syncAgent(agentById(target), task, now), task);
        const eventTypes = { in_progress: 'task_started', review: 'task_review', testing: 'task_testing', completed: 'task_completed', failed: 'task_failed' } as const;
        emit(eventTypes[command.status as keyof typeof eventTypes], agentById(target), task, `${eventTypes[command.status as keyof typeof eventTypes]}: «${task.title}»`);
      }
    }
    next.activity = [...events].reverse().concat(next.activity).slice(0, configuration.activityLimit);
    this.state = next;
    this.events.publish(events);
    return result;
  }
}
