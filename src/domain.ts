export const statuses = ['idle', 'thinking', 'working', 'waiting', 'reviewing', 'testing', 'completed', 'error'] as const;
export type AgentStatus = typeof statuses[number];
export const taskStatuses = ['pending', 'in_progress', 'review', 'testing', 'paused', 'completed', 'failed'] as const;
export type TaskStatus = typeof taskStatuses[number];
export type Priority = 'low' | 'normal' | 'high';
export type InstallationStatus = 'installed' | 'available' | 'verification_required' | 'installation_failed';
export interface EmployeeSkill {
  skillId: string; skillName: string; description: string; originalSkillName: string;
  sourceRepository: string; sourcePath: string; license: string; sourceCommit: string;
  installedVersion: string | null; assignedEmployeeId: string;
  installationStatus: InstallationStatus; statusReason: string; dependencies: readonly string[]; risks: readonly string[];
}
export interface AgentSkillAssignment {
  skillId: string; skillName: string; skillDescription: string; customAgentId: string; responsibility: string;
  skills: readonly EmployeeSkill[];
}
export interface Agent extends AgentSkillAssignment {
  projectId?:string; id: string; role: string; name: string; status: AgentStatus;
  currentTask: string | null; progress: number; progressIndeterminate?: boolean; activity: string;
  lastActivity: string | null; startedAt: string | null; completedAt: string | null;
}
export interface Task {
  projectId?:string;workflowId?:string;branch?:string|null;updatedAt?:string; id: string; title: string; description: string; status: TaskStatus;
  assignedAgent: string | null; priority: Priority; progress: number; progressIndeterminate?: boolean;
  createdAt: string; startedAt: string | null; completedAt: string | null;
  pauseReason?: string; checkpointId?: string;
}
export type {Project} from './projects/model.ts';
import type {Project} from './projects/model.ts';
export type EventType = 'task_created' | 'task_assigned' | 'task_started' | 'task_progress' | 'task_review' | 'task_testing' | 'task_completed' | 'task_failed' | 'agent_status_changed' | 'runtime_event' | 'task_pause_requested' | 'task_paused' | 'task_paused_limit' | 'checkpoint_created' | 'task_resume_requested' | 'task_resumed' | 'checkpoint_restored' | 'resume_failed';
export interface ActivityEvent {
  projectId?:string;branch?:string|null; id: string; type: EventType; agentId: string; taskId: string | null;
  message: string; timestamp: string; status: AgentStatus; source: 'mock' | 'codex'; runtimeMethod?: string;
}
export interface OfficeState { agents: Agent[]; tasks: Task[]; projects: Project[]; activity: ActivityEvent[] }
export type OfficeCommand =
  | { type: 'create'; title: string; description: string; priority: Priority; actorId?: string }
  | { type: 'assign'; taskId: string; agentId: string }
  | { type: 'transition'; taskId: string; status: TaskStatus; agentId?: string }
  | { type: 'progress'; taskId: string; progress: number }
  | { type: 'agent_status'; agentId: string; status: AgentStatus; activity?: string };
