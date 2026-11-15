import type { AgentSkillAssignment, InstallationStatus } from '../domain.ts';
const labels: Record<InstallationStatus, string> = {
  installed: 'Installed', available: 'Available · не установлен',
  verification_required: 'Verification required', installation_failed: 'Installation failed',
};
export function AgentSkills({ agent, runtimeConnected = false }: { agent: AgentSkillAssignment; runtimeConnected?: boolean }) {
  return <section className="agent-skills" aria-label="Навык и ответственность сотрудника">
    <small>COMMUNITY SKILLS · {agent.skills.length}</small>
    <ul className="community-skills">{agent.skills.map(skill => <li key={skill.skillId}>
      <h3>{skill.skillName}</h3><span className={`installation-status ${skill.installationStatus}`}>{labels[skill.installationStatus]}</span>
      <p>{skill.description}</p>
      <details><summary>Источник и проверка</summary>
        <a href={`${skill.sourceRepository}/tree/${skill.sourceCommit}/${skill.sourcePath}`} target="_blank" rel="noreferrer">{skill.sourceRepository.replace('https://github.com/', '')}</a>
        <code>{skill.originalSkillName} · {skill.sourceCommit.slice(0, 12)}</code><p>{skill.license}</p>
        <p>{skill.statusReason}</p>
        <p>Зависимости: {skill.dependencies.length ? skill.dependencies.join('; ') : 'Нет дополнительных инструментов.'}</p>
        <p>{skill.risks.join(' ')}</p>
      </details>
    </li>)}</ul>
    <small>ОТВЕТСТВЕННОСТЬ</small><p>{agent.responsibility}</p>
    <details><summary>Профиль Codex</summary><code>{agent.customAgentId}</code><p>{runtimeConnected?'Сотрудник подключён к Codex; профиль передаётся как developer instructions при запуске задания.':'Профиль подготовлен. В mock реальные агенты не запущены. Этот сотрудник сейчас не подключён к реальному Codex.'}</p></details>
  </section>;
}
