import { configuration, team } from '../config.ts';
import type { OfficeState } from '../domain.ts';
import { statusActivity } from './agents.ts';
import { getAgentSkillAssignment } from '../agents/registry.ts';
export function createOffice(): OfficeState {
  const agents = team.map(([id, role, name]) => ({ id, role, name, ...getAgentSkillAssignment(id), status: 'idle' as const, currentTask: null, progress: 0, activity: statusActivity.idle, lastActivity: null, startedAt: null, completedAt: null }));
  return { agents, tasks: [], projects: [{ id: configuration.projectId, name: 'AI Office', repository: null, status: 'demo', agents: agents.map(a => a.id) }], activity: [] };
}
export function metrics(state: OfficeState) {
  return { active: state.agents.filter(a => ['working', 'thinking', 'reviewing', 'testing'].includes(a.status)).length,
    total: state.tasks.length, completed: state.tasks.filter(t => t.status === 'completed').length,
    inProgress: state.tasks.filter(t => ['in_progress', 'review', 'testing'].includes(t.status)).length,
    errors: state.tasks.filter(t => t.status === 'failed').length };
}
