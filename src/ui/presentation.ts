import type { Agent, AgentStatus, TaskStatus } from '../domain.ts';
import { team } from '../config.ts';
import { taskAgentStatus } from '../state/agents.ts';
export const displayStatus = { idle: 'Idle', thinking: 'Thinking', working: 'Working', waiting: 'Waiting', reviewing: 'Reviewing', testing: 'Testing', completed: 'Completed', error: 'Error' } as const;
export type AgentView = Omit<Agent, 'status'> & { status: typeof displayStatus[AgentStatus]; color: string; hair: string; skin: string };
export function agentView(agent: Agent): AgentView {
  const [, , , color, hair, skin] = team.find(row => row[0] === agent.id)!;
  return { ...agent, status: displayStatus[agent.status], color, hair, skin };
}
export const taskDisplayStatus = (status: TaskStatus) => displayStatus[taskAgentStatus[status]];
