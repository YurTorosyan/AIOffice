import type { Agent, AgentStatus, Task, TaskStatus } from '../domain.ts';
export const statusActivity: Record<AgentStatus, string> = {
  working: 'Работает над задачей', thinking: 'Обдумывает решение', waiting: 'Ожидает следующий шаг',
  reviewing: 'Проверяет материалы', testing: 'Запускает проверки', idle: 'Готов к новой задаче',
  error: 'Требуется внимание', completed: 'Задача завершена',
};
export const taskAgentStatus: Record<TaskStatus, AgentStatus> = {
  pending: 'waiting', in_progress: 'working', review: 'reviewing', testing: 'testing', completed: 'completed', failed: 'error',
};
export function syncAgent(agent: Agent, task: Task, now: string): Agent {
  const status = taskAgentStatus[task.status];
  return { ...agent, currentTask: task.id, status, progress: task.progress, activity: statusActivity[status],
    lastActivity: now, startedAt: agent.currentTask === task.id ? (agent.startedAt ?? task.startedAt) : task.startedAt ? now : null,
    completedAt: task.completedAt };
}
export function releaseAgent(agent: Agent, now: string): Agent {
  return { ...agent, status: 'idle', currentTask: null, progress: 0, activity: statusActivity.idle, lastActivity: now, startedAt: null, completedAt: null };
}
