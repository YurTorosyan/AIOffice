import type { AgentSkillAssignment } from '../domain.ts';
export function AgentSkills({ agent }: { agent: AgentSkillAssignment }) {
  return <section className="agent-skills" aria-label="Навык и ответственность сотрудника">
    <small>ОСНОВНОЙ SKILL</small><h3>{agent.skillName}</h3><p>{agent.skillDescription}</p>
    <small>ОТВЕТСТВЕННОСТЬ</small><p>{agent.responsibility}</p>
    <details><summary>Профиль Codex</summary><code>{agent.customAgentId}</code><p>Конфигурация подготовлена. В офисе работает mock, реальные агенты не запущены.</p></details>
  </section>;
}
