import data from './registry.json' with { type: 'json' };
import { team } from '../config.ts';
import type { AgentSkillAssignment } from '../domain.ts';
export interface SkillDefinition { id: string; name: string; description: string; path: string }
export interface CustomAgentDefinition { id: string; employeeId: string; skillId: string; path: string }
export interface EmployeeDefinition { id: string; role: string; skillId: string; customAgentId: string; responsibility: string }
export interface AgentRegistry {
  skills: readonly SkillDefinition[]; customAgents: readonly CustomAgentDefinition[]; employees: readonly EmployeeDefinition[];
}
/** Validate referential integrity independently of React and of a filesystem. */
export function validateRegistry(registry: AgentRegistry): string[] {
  const errors: string[] = [];
  for (const [label, rows] of [['skills', registry.skills], ['customAgents', registry.customAgents], ['employees', registry.employees]] as const) {
    if (rows.length !== 8) errors.push(`${label}: expected exactly 8 definitions`);
    if (new Set(rows.map(row => row.id)).size !== rows.length) errors.push(`${label}: duplicate IDs`);
    if (rows.some(row => !row.id.trim())) errors.push(`${label}: empty ID`);
  }
  if (new Set(registry.employees.map(e => e.skillId)).size !== registry.employees.length) errors.push('employees: duplicate primary Skill assignment');
  if (new Set(registry.employees.map(e => e.customAgentId)).size !== registry.employees.length) errors.push('employees: duplicate Custom Agent assignment');
  for (const [id, role] of team) {
    const employee = registry.employees.find(e => e.id === id);
    if (!employee) { errors.push(`Missing employee: ${id}`); continue; }
    if (employee.role !== role) errors.push(`Incorrect role: ${id}`);
    if (!employee.responsibility.trim()) errors.push(`Missing responsibility: ${id}`);
    const skill = registry.skills.find(s => s.id === employee.skillId);
    if (!skill) errors.push(`Missing Skill: ${id}/${employee.skillId}`);
    else if (!skill.name.trim() || !skill.description.trim() || skill.path !== `.agents/skills/${skill.id}/SKILL.md`) errors.push(`Invalid Skill definition: ${skill.id}`);
    const profile = registry.customAgents.find(p => p.id === employee.customAgentId);
    if (!profile) errors.push(`Missing Custom Agent: ${id}/${employee.customAgentId}`);
    else if (profile.employeeId !== id || profile.skillId !== employee.skillId || profile.path !== `.codex/agents/${profile.id}.toml`) errors.push(`Incorrect role-to-Skill/profile assignment: ${id}`);
  }
  for (const employee of registry.employees) if (!team.some(([id]) => id === employee.id)) errors.push(`Unknown employee: ${employee.id}`);
  return errors;
}
const errors = validateRegistry(data);
if (errors.length) throw new Error(`Invalid AI Office registry: ${errors.join('; ')}`);
// Consumers cannot accidentally mutate shared configuration.
export const agentRegistry: AgentRegistry = Object.freeze({
  skills: Object.freeze(data.skills.map(row => Object.freeze(row))),
  customAgents: Object.freeze(data.customAgents.map(row => Object.freeze(row))),
  employees: Object.freeze(data.employees.map(row => Object.freeze(row))),
});
export function getAgentSkillAssignment(employeeId: string): AgentSkillAssignment {
  const employee = agentRegistry.employees.find(e => e.id === employeeId);
  if (!employee) throw new Error(`Unknown AI Office employee: ${employeeId}`);
  const skill = agentRegistry.skills.find(s => s.id === employee.skillId)!;
  return { skillId: skill.id, skillName: skill.name, skillDescription: skill.description, customAgentId: employee.customAgentId, responsibility: employee.responsibility };
}
