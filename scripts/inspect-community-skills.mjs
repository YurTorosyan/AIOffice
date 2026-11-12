import { readFileSync, existsSync, readdirSync, lstatSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repositoryPattern = /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function inside(root, target) {
  const rel = relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}
function walk(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = resolve(directory, name), stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('Symbolic links require separate verification');
    return stat.isDirectory() ? walk(path) : [path];
  });
}
/** Read only: never execute third-party content or access the network/credentials. */
export function inspectInstallations(root, registry, lock) {
  root = realpathSync(root);
  const result = {};
  for (const skill of registry.skills) {
    const record = { installationStatus: skill.installationStatus, reason: skill.verification, checkedFiles: 0 };
    result[skill.id] = record;
    try {
      if (!repositoryPattern.test(skill.sourceRepository)) throw new Error('Invalid GitHub repository');
      const manifest = resolve(root, skill.path), folder = dirname(manifest);
      if (!inside(root, manifest) || !skill.path.startsWith('.agents/skills/')) throw new Error('Invalid installation path');
      if (skill.installationStatus !== 'installed') {
        if (existsSync(manifest)) { record.installationStatus = 'verification_required'; record.reason = 'Files exist without an approved installation; verification required.'; }
        continue;
      }
      const receipt = lock.skills[skill.id];
      if (!receipt || receipt.commit !== skill.installedVersion || receipt.commit !== skill.sourceCommit || receipt.sourceRepository !== skill.sourceRepository || receipt.sourcePath !== skill.sourcePath) throw new Error('Missing or mismatched pinned installation receipt');
      if (!receipt.files.some(f => f.path === skill.path)) throw new Error('Receipt does not include SKILL.md');
      if (new Set(receipt.files.map(f => f.path)).size !== receipt.files.length) throw new Error('Duplicate receipt paths');
      const missing = [];
      for (const file of receipt.files) {
        const path = resolve(root, file.path);
        if (!inside(resolve(root, '.agents'), path) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid receipt path/hash');
        if (!existsSync(path)) { missing.push(file.path); continue; }
        if (!inside(root, realpathSync(path))) throw new Error('Installation escapes project');
        if (lstatSync(path).isSymbolicLink()) throw new Error('Symbolic link in installation');
        if (digest(readFileSync(path)) !== file.sha256) throw new Error(`Changed file requires verification: ${file.path}`);
        record.checkedFiles++;
      }
      if (missing.length) { record.installationStatus = 'installation_failed'; record.reason = `Missing installation files: ${missing.join(', ')}`; continue; }
      const approved = new Set(receipt.files.map(f => resolve(root, f.path)));
      if (walk(folder).some(path => !approved.has(path))) throw new Error('Unreviewed extra files in installed Skill');
      record.installationStatus = 'installed';
      record.reason = `${record.checkedFiles} local files match the pinned SHA-256 receipt. Files installed; optional tools are not implied.`;
    } catch (error) {
      record.installationStatus = 'verification_required';
      record.reason = error.message;
    }
  }
  return { formatVersion: 1, skills: result };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const registry = JSON.parse(readFileSync(resolve(root, 'src/agents/registry.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(root, '.agents/community-skills.lock.json'), 'utf8'));
  const evidence = inspectInstallations(root, registry, lock);
  if (process.argv.includes('--write')) writeFileSync(resolve(root, 'src/agents/installation-state.generated.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  const installed = registry.skills.filter(s => s.installationStatus === 'installed');
  const failures = installed.filter(s => evidence.skills[s.id].installationStatus !== 'installed');
  console.log(`Community Skills: ${installed.length - failures.length}/${installed.length} pinned installations verified; ${registry.skills.length - installed.length} catalog candidates are not installed.`);
  if (failures.length) {
    for (const skill of failures) console.error(`${skill.id}: ${evidence.skills[skill.id].reason}`);
    // Startup still displays the actual failed status; explicit checks/tests/builds fail closed.
    if (!process.argv.includes('--write')) process.exitCode = 1;
  }
}
