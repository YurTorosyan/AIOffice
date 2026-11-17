import {noRepository} from '../projects/model.ts';
import { configuration, team } from '../config.ts';
import type { OfficeState } from '../domain.ts';
import { statusActivity } from './agents.ts';
import { getAgentSkillAssignment } from '../agents/registry.ts';
export function createOffice(projectId:string=configuration.projectId): OfficeState {
  const agents = team.map(([id, role, name]) => ({ projectId,id, role, name, ...getAgentSkillAssignment(id), status: 'idle' as const, currentTask: null, progress: 0, activity: statusActivity.idle, lastActivity: null, startedAt: null, completedAt: null }));
  return { agents, tasks: [], projects: [{ id:projectId,name:'AI Office',description:'',workspaceRoot:'mock://'+projectId,repository:noRepository('mock://'+projectId),status:'ACTIVE',defaultBranch:null,createdAt:'2026-11-12T00:00:00.000Z',updatedAt:'2026-11-12T00:00:00.000Z',lastOpenedAt:null }], activity: [] };
}
export function metrics(state: OfficeState) {
  return { active: state.agents.filter(a => ['working', 'thinking', 'reviewing', 'testing'].includes(a.status)).length,
    total: state.tasks.length, completed: state.tasks.filter(t => t.status === 'completed').length,
    inProgress: state.tasks.filter(t => ['in_progress', 'review', 'testing'].includes(t.status)).length,
    errors: state.tasks.filter(t => t.status === 'failed').length };
}
