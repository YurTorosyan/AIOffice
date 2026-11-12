export const statuses = ['Working','Thinking','Waiting','Reviewing','Testing','Idle','Error','Completed'] as const;
export type AgentStatus = typeof statuses[number];
export interface Agent { id: string; role: string; name: string; color: string; hair: string; skin: string; status: AgentStatus; currentTask: string; progress: number; activity: string }
export interface Task { id: string; title: string; description: string; status: AgentStatus; assignedAgent: string; startedAt: string | null; completedAt: string | null }
export interface Project { id: string; name: string; repository: string | null; status: 'demo'; agents: string[] }
export interface ActivityEvent { id: string; agentId: string; message: string; timestamp: string; status: AgentStatus; source: 'mock' }
export interface OfficeState { agents: Agent[]; tasks: Task[]; projects: Project[]; activity: ActivityEvent[] }
export interface AgentUpdate { agentId: string; status: AgentStatus; progress: number; timestamp: string; id: string }
