import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { agentRegistry, getAgentSkillAssignment, validateRegistry } from '../src/agents/registry.ts';
import type { AgentSkillAssignment } from '../src/domain.ts';
import { createOffice } from '../src/state/office.ts';
import { MockCodexAdapter } from '../src/integration/MockCodexAdapter.ts';

const expected = [
  ['lead', 'Lead Developer', 'project-architecture', 'lead-developer'],
  ['design', 'UI/UX Designer', 'ui-ux-design', 'ui-ux-designer'],
  ['frontend', 'Frontend Developer', 'frontend-engineering', 'frontend-developer'],
  ['backend', 'Backend Developer', 'backend-engineering', 'backend-developer'],
  ['seo', 'SEO Specialist', 'technical-seo', 'seo-specialist'],
  ['security', 'Security Engineer', 'security-audit', 'security-engineer'],
  ['qa', 'QA Engineer', 'quality-assurance', 'qa-engineer'],
  ['review', 'Technical Reviewer', 'independent-code-review', 'technical-reviewer'],
];

test('all eight existing employee IDs and roles map to the required primary Skills and profiles', () => {
  assert.deepEqual(validateRegistry(agentRegistry), []);
  assert.deepEqual(agentRegistry.employees.map(e => [e.id, e.role, e.skillId, e.customAgentId]), expected);
  assert.equal(agentRegistry.skills.length, 8); assert.equal(agentRegistry.customAgents.length, 8);
  assert.equal(new Set(agentRegistry.skills.map(s => s.id)).size, 8);
  assert.equal(new Set(agentRegistry.customAgents.map(p => p.id)).size, 8);
  assert.equal(new Set(agentRegistry.employees.map(e => e.skillId)).size, 8);
});
test('missing Skill and missing Custom Agent definitions are detected with employee references', () => {
  const registry = structuredClone(agentRegistry);
  registry.skills = registry.skills.filter(s => s.id !== 'security-audit');
  registry.customAgents = registry.customAgents.filter(p => p.id !== 'qa-engineer');
  const errors = validateRegistry(registry);
  assert.ok(errors.some(e => e.includes('Missing Skill: security/security-audit')));
  assert.ok(errors.some(e => e.includes('Missing Custom Agent: qa/qa-engineer')));
});
test('duplicate Skill/profile IDs and duplicate primary assignments are rejected', () => {
  const registry = structuredClone(agentRegistry);
  registry.skills = registry.skills.map((s, i) => i === 1 ? { ...s, id: registry.skills[0].id } : s);
  registry.customAgents = registry.customAgents.map((p, i) => i === 1 ? { ...p, id: registry.customAgents[0].id } : p);
  registry.employees = registry.employees.map((e, i) => i === 1 ? { ...e, skillId: registry.employees[0].skillId, customAgentId: registry.employees[0].customAgentId } : e);
  const errors = validateRegistry(registry);
  for (const text of ['skills: duplicate IDs', 'customAgents: duplicate IDs', 'duplicate primary Skill', 'duplicate Custom Agent']) assert.ok(errors.some(e => e.includes(text)), text);
});
test('role mismatch, wrong profile owner, swapped Skill and broken paths fail validation', () => {
  const registry = structuredClone(agentRegistry);
  registry.employees = registry.employees.map(e => e.id === 'lead' ? { ...e, role: 'Director' } : e.id === 'frontend' ? { ...e, skillId: 'security-audit' } : e);
  registry.customAgents = registry.customAgents.map(p => p.id === 'qa-engineer' ? { ...p, employeeId: 'review' } : p);
  registry.skills = registry.skills.map(s => s.id === 'ui-ux-design' ? { ...s, path: 'missing.md' } : s);
  const errors = validateRegistry(registry);
  assert.ok(errors.includes('Incorrect role: lead'));
  assert.ok(errors.some(e => e.includes('assignment: frontend'))); assert.ok(errors.some(e => e.includes('assignment: qa')));
  assert.ok(errors.some(e => e.includes('Invalid Skill definition: ui-ux-design')));
});
test('each model exposes all Skill fields and keeps metadata through workflow and reset', () => {
  const adapter = new MockCodexAdapter();
  const assignments = adapter.getAgents().map(a => getAgentSkillAssignment(a.id));
  adapter.startWorkflow(); for (let i = 0; i < 8; i++) adapter.advanceWorkflow();
  for (const [index, a] of adapter.getAgents().entries()) {
    const { skillId, skillName, skillDescription, customAgentId, responsibility } = a;
    assert.deepEqual({ skillId, skillName, skillDescription, customAgentId, responsibility }, assignments[index]);
  }
  adapter.reset(); assert.deepEqual(adapter.getAgents(), createOffice().agents);
  assert.throws(() => getAgentSkillAssignment('director'));
});
test('every declared Skill and profile has an existing project-local source file', () => {
  const root = new URL('../', import.meta.url);
  for (const entry of [...agentRegistry.skills, ...agentRegistry.customAgents]) assert.ok(existsSync(new URL(entry.path, root)), entry.path);
});
test('employee details render the correct name, description, responsibility and mock disclaimer for all eight', () => {
  // Transpile the actual TSX component using the existing build dependency; no test framework is added.
  const source = readFileSync(new URL('../src/ui/AgentSkills.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: { AgentSkills?: ComponentType<{ agent: AgentSkillAssignment }> } = {};
  runInNewContext(output, { exports, require: createRequire(import.meta.url) });
  assert.ok(exports.AgentSkills);
  for (const agent of createOffice().agents) {
    const html = renderToStaticMarkup(createElement(exports.AgentSkills!, { agent }));
    for (const text of [agent.skillName, agent.skillDescription, agent.responsibility, agent.customAgentId]) assert.ok(html.includes(text), `${agent.id}: ${text}`);
    assert.ok(html.includes('реальные агенты не запущены'));
  }
});
test('all eight YAML Skill manifests and TOML profiles pass real syntax and reference validation', () => {
  const output = execFileSync('python', ['scripts/validate_agents.py'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.ok(output.includes('8 SKILL.md YAML manifests, 8 TOML profiles, 8 matching employee definitions'));
});
