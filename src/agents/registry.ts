import data from './registry.json' with { type: 'json' };
import evidence from './installation-state.generated.json' with { type: 'json' };
import { team } from '../config.ts';
import type { AgentSkillAssignment, EmployeeSkill, InstallationStatus } from '../domain.ts';
export interface SkillDefinition extends Omit<EmployeeSkill, 'assignedEmployeeId' | 'statusReason'> {
  id: string; name: string; path: string; verification: string; licenseSource: string;
}
export interface CustomAgentDefinition { id: string; employeeId: string; skillId: string; path: string }
export interface EmployeeDefinition { id: string; role: string; skillId: string; customAgentId: string; responsibility: string }
export interface SkillAssignment { skillId: string; assignedEmployeeId: string; justification: string }
export interface AgentRegistry {
  skills: readonly SkillDefinition[]; customAgents: readonly CustomAgentDefinition[];
  employees: readonly EmployeeDefinition[]; skillAssignments: readonly SkillAssignment[];
}
const statuses: readonly string[] = ['installed', 'available', 'verification_required', 'installation_failed'];
export function isGithubRepository(value: string) {
  return /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}
const safePath = (value: string) => /^[A-Za-z0-9._/-]+$/.test(value) && !!value && !value.startsWith('/') && !value.includes('\\') && !value.split('/').some(p => !p || p === '..' || p === '.');
/** Validate the catalog independently of React, networking and the filesystem. */
export function validateRegistry(registry: AgentRegistry): string[] {
  const errors: string[] = [];
  for (const [label, rows] of [['skills', registry.skills], ['customAgents', registry.customAgents], ['employees', registry.employees]] as const) {
    if (label !== 'skills' && rows.length !== 8) errors.push(`${label}: expected exactly 8 definitions`);
    if (new Set(rows.map(row => row.id)).size !== rows.length) errors.push(`${label}: duplicate IDs`);
    if (rows.some(row => !row.id.trim())) errors.push(`${label}: empty ID`);
  }
  for (const skill of registry.skills) {
    if (skill.skillId !== skill.id || skill.originalSkillName !== skill.id || skill.name !== skill.skillName || !skill.name.trim() || !skill.description.trim() || skill.path !== `.agents/skills/${skill.id}/SKILL.md` || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.id)) errors.push(`Invalid Skill definition: ${skill.id}`);
    if (!isGithubRepository(skill.sourceRepository)) errors.push(`Invalid repository: ${skill.id}`);
    if (!safePath(skill.sourcePath) || !safePath(skill.licenseSource) || !/^[a-f0-9]{40}$/.test(skill.sourceCommit) || !skill.license.trim()) errors.push(`Invalid provenance: ${skill.id}`);
    if (!statuses.includes(skill.installationStatus) || (skill.installationStatus === 'installed' && skill.installedVersion !== skill.sourceCommit)) errors.push(`Invalid installation: ${skill.id}`);
  }
  const pairs = registry.skillAssignments.map(a => `${a.assignedEmployeeId}/${a.skillId}`);
  if (new Set(pairs).size !== pairs.length) errors.push('Duplicate employee-to-Skill assignment');
  for (const assignment of registry.skillAssignments) {
    if (!registry.skills.some(s => s.id === assignment.skillId)) errors.push(`Missing Skill: ${assignment.assignedEmployeeId}/${assignment.skillId}`);
    if (!team.some(([id]) => id === assignment.assignedEmployeeId)) errors.push(`Unknown assigned employee: ${assignment.assignedEmployeeId}`);
    if (!assignment.justification.trim()) errors.push(`Missing assignment justification: ${assignment.skillId}`);
  }
  if (new Set(registry.employees.map(e => e.customAgentId)).size !== registry.employees.length) errors.push('employees: duplicate Custom Agent assignment');
  for (const [id, role] of team) {
    const employee = registry.employees.find(e => e.id === id);
    if (!employee) { errors.push(`Missing employee: ${id}`); continue; }
    if (employee.role !== role) errors.push(`Incorrect role: ${id}`);
    if (!employee.responsibility.trim()) errors.push(`Missing responsibility: ${id}`);
    const primary = registry.skills.find(s => s.id === employee.skillId);
    if (!primary) errors.push(`Missing Skill: ${id}/${employee.skillId}`);
    if (!registry.skillAssignments.some(a => a.assignedEmployeeId === id && a.skillId === employee.skillId)) errors.push(`Missing primary assignment: ${id}`);
    const profile = registry.customAgents.find(p => p.id === employee.customAgentId);
    if (!profile) errors.push(`Missing Custom Agent: ${id}/${employee.customAgentId}`);
    else if (profile.employeeId !== id || profile.skillId !== employee.skillId || profile.path !== `.codex/agents/${profile.id}.toml`) errors.push(`Incorrect role-to-Skill/profile assignment: ${id}`);
  }
  for (const employee of registry.employees) if (!team.some(([id]) => id === employee.id)) errors.push(`Unknown employee: ${employee.id}`);
  return errors;
}
// JSON is validated before becoming application configuration.
const configuration = data as AgentRegistry;
const errors = validateRegistry(configuration);
if (errors.length) throw new Error(`Invalid AI Office registry: ${errors.join('; ')}`);
export const agentRegistry: AgentRegistry = Object.freeze({
  skills: Object.freeze(configuration.skills.map(row => Object.freeze({ ...row, dependencies: Object.freeze([...row.dependencies]), risks: Object.freeze([...row.risks]) }))),
  customAgents: Object.freeze(configuration.customAgents.map(row => Object.freeze(row))),
  employees: Object.freeze(configuration.employees.map(row => Object.freeze(row))),
  skillAssignments: Object.freeze(configuration.skillAssignments.map(row => Object.freeze(row))),
});
const installationEvidence: Record<string, { installationStatus: string; reason: string }> = evidence.skills;
export function getEmployeeSkills(employeeId: string): EmployeeSkill[] {
  return agentRegistry.skillAssignments.filter(a => a.assignedEmployeeId === employeeId).map(assignment => {
    const skill = agentRegistry.skills.find(s => s.id === assignment.skillId)!;
    const actual = installationEvidence[skill.id];
    const status = actual && statuses.includes(actual.installationStatus) ? actual.installationStatus as InstallationStatus : 'verification_required';
    return { skillId: skill.id, skillName: skill.name, description: skill.description, originalSkillName: skill.originalSkillName,
      sourceRepository: skill.sourceRepository, sourcePath: skill.sourcePath, license: skill.license, sourceCommit: skill.sourceCommit,
      installedVersion: skill.installedVersion, assignedEmployeeId: employeeId, installationStatus: status,
      statusReason: actual?.reason ?? 'No local installation evidence. Run the installation check.', dependencies: [...skill.dependencies], risks: [...skill.risks] };
  });
}
export function getAgentSkillAssignment(employeeId: string): AgentSkillAssignment {
  const employee = agentRegistry.employees.find(e => e.id === employeeId);
  if (!employee) throw new Error(`Unknown AI Office employee: ${employeeId}`);
  const skill = agentRegistry.skills.find(s => s.id === employee.skillId)!;
  return { skillId: skill.id, skillName: skill.name, skillDescription: skill.description, customAgentId: employee.customAgentId, responsibility: employee.responsibility, skills: getEmployeeSkills(employeeId) };
}
