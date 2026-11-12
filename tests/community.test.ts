import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, unlinkSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { inspectInstallations } from '../scripts/inspect-community-skills.mjs';
import { agentRegistry, getAgentSkillAssignment, getEmployeeSkills, isGithubRepository, validateRegistry } from '../src/agents/registry.ts';
import type { AgentSkillAssignment, InstallationStatus } from '../src/domain.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
function fixture() {
  const base = join(projectRoot, 'work', 'community-test-fixtures'); mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, 'case-'));
  const skill = { ...agentRegistry.skills.find(s => s.id === 'webapp-testing')! };
  const directory = join(root, '.agents', 'skills', skill.id); mkdirSync(join(directory, 'scripts'), { recursive: true });
  const files = [{ path: skill.path, text: '---\nname: webapp-testing\ndescription: fixture\n---\nTest fixture.' }, { path: `.agents/skills/${skill.id}/scripts/with_server.py`, text: '# Fixture only. Never executed.\n' }];
  for (const f of files) writeFileSync(join(root, f.path), f.text);
  const receipt = { sourceRepository: skill.sourceRepository, sourcePath: skill.sourcePath, commit: skill.sourceCommit, files: files.map(f => ({ path: f.path, sha256: createHash('sha256').update(f.text).digest('hex') })) };
  return { root, skill, registry: { skills: [skill] }, lock: { skills: { [skill.id]: receipt } }, cleanup: () => {
    // Confirm the resolved recursive-delete target is one owned fixture under the workspace.
    assert.equal(dirname(realpathSync(root)), realpathSync(base)); rmSync(root, { recursive: true });
  } };
}
test('employees can have multiple Skills and a justified Skill can be shared', () => {
  assert.equal(getEmployeeSkills('backend').length, 2); assert.equal(getEmployeeSkills('lead').length, 3);
  const shared = agentRegistry.skillAssignments.filter(a => a.skillId === 'code-review-and-quality');
  assert.deepEqual(shared.map(a => a.assignedEmployeeId), ['lead', 'review']);
  assert.ok(shared.every(a => a.justification.length > 20));
  assert.ok(getEmployeeSkills('seo').every(s => s.assignedEmployeeId === 'seo'));
  assert.ok(getEmployeeSkills('seo').some(s => s.installationStatus === 'available'));
});
test('installed references match exact repositories, source paths and full immutable commits', () => {
  const expected = new Set(['https://github.com/addyosmani/agent-skills', 'https://github.com/anthropics/skills', 'https://github.com/vercel-labs/agent-skills', 'https://github.com/coreyhaines31/marketingskills']);
  const installed = agentRegistry.skills.filter(s => s.installationStatus === 'installed');
  assert.equal(new Set(installed.map(s => s.id)).size, 12);
  for (const s of installed) { assert.ok(expected.has(s.sourceRepository)); assert.match(s.installedVersion!, /^[a-f0-9]{40}$/); assert.equal(s.installedVersion, s.sourceCommit); assert.ok(s.sourcePath.startsWith('skills/')); }
  const lock = JSON.parse(readFileSync(join(projectRoot, '.agents/community-skills.lock.json'), 'utf8'));
  const actual = inspectInstallations(projectRoot, agentRegistry, lock);
  for (const s of installed) { assert.equal(actual.skills[s.id].installationStatus, 'installed'); assert.ok(actual.skills[s.id].checkedFiles >= 2); }
});
test('invalid repositories are rejected without fetching them', () => {
  for (const value of ['http://github.com/owner/repo', 'https://github.com.evil.test/owner/repo', 'https://github.com/owner/repo?token=example', 'file:///repo', 'https://user@github.com/owner/repo']) assert.equal(isGithubRepository(value), false);
  const registry = structuredClone(agentRegistry); registry.skills = registry.skills.map((s, i) => i === 0 ? { ...s, sourceRepository: 'https://evil.test/owner/repo' } : s);
  assert.ok(validateRegistry(registry).some(e => e.startsWith('Invalid repository:')));
});
test('missing installation is detected even when the registry says installed', () => {
  const f = fixture(); try { unlinkSync(join(f.root, f.skill.path)); const state = inspectInstallations(f.root, f.registry, f.lock); assert.equal(state.skills[f.skill.id].installationStatus, 'installation_failed'); assert.match(state.skills[f.skill.id].reason, /Missing installation files/); } finally { f.cleanup(); }
});
test('missing additional script prevents a complete installation claim', () => {
  const f = fixture(); try { unlinkSync(join(f.root, `.agents/skills/${f.skill.id}/scripts/with_server.py`)); assert.equal(inspectInstallations(f.root, f.registry, f.lock).skills[f.skill.id].installationStatus, 'installation_failed'); } finally { f.cleanup(); }
});
test('modified content requires re-verification instead of Installed', () => {
  const f = fixture(); try { writeFileSync(join(f.root, f.skill.path), 'modified'); assert.equal(inspectInstallations(f.root, f.registry, f.lock).skills[f.skill.id].installationStatus, 'verification_required'); } finally { f.cleanup(); }
});
test('an unreviewed extra script is detected and never executed', () => {
  const f = fixture(); try { const marker = join(f.root, 'executed'); writeFileSync(join(f.root, `.agents/skills/${f.skill.id}/unexpected.mjs`), `throw new Error('must never execute');`); assert.equal(inspectInstallations(f.root, f.registry, f.lock).skills[f.skill.id].installationStatus, 'verification_required'); assert.equal(existsSync(marker), false); } finally { f.cleanup(); }
});
test('a registry name alone is insufficient without a pinned receipt', () => {
  const f = fixture(); try { assert.equal(inspectInstallations(f.root, f.registry, { skills: {} }).skills[f.skill.id].installationStatus, 'verification_required'); } finally { f.cleanup(); }
});
test('candidate Skills are never marked installed and retain their distinct statuses', () => {
  const f = fixture(); try {
    unlinkSync(join(f.root, f.skill.path));
    const registry = { skills: [{ ...f.skill, installationStatus: 'available', installedVersion: null }] };
    assert.equal(inspectInstallations(f.root, registry, { skills: {} }).skills[f.skill.id].installationStatus, 'available');
    registry.skills[0].installationStatus = 'verification_required';
    assert.equal(inspectInstallations(f.root, registry, { skills: {} }).skills[f.skill.id].installationStatus, 'verification_required');
  } finally { f.cleanup(); }
});
test('unknown employees and duplicate assignment pairs are rejected', () => {
  const registry = structuredClone(agentRegistry);
  registry.skillAssignments = [...registry.skillAssignments, { ...registry.skillAssignments[0] }, { skillId: 'seo-audit', assignedEmployeeId: 'director', justification: 'Invalid employee fixture' }];
  const errors = validateRegistry(registry); assert.ok(errors.includes('Duplicate employee-to-Skill assignment')); assert.ok(errors.includes('Unknown assigned employee: director'));
});
test('employee details display all four installation states and safe source links', () => {
  const source = readFileSync(new URL('../src/ui/AgentSkills.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: { AgentSkills?: ComponentType<{ agent: AgentSkillAssignment }> } = {};
  runInNewContext(output, { exports, require: createRequire(import.meta.url) });
  const agent = getAgentSkillAssignment('lead');
  const states: InstallationStatus[] = ['installed', 'available', 'verification_required', 'installation_failed'];
  const html = renderToStaticMarkup(createElement(exports.AgentSkills!, { agent: { ...agent, skills: states.map((state, i) => ({ ...agent.skills[0], skillId: `fixture-${i}`, installationStatus: state })) } }));
  for (const label of ['Installed', 'Available', 'Verification required', 'Installation failed']) assert.ok(html.includes(label));
  assert.ok(html.includes('https://github.com/addyosmani/agent-skills/tree/')); assert.ok(html.includes('rel="noreferrer"'));
});
