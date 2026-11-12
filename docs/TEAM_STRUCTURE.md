# Постоянная команда AI Office — Stage 3B

Director — владелец и источник решений; он не входит в восемь работников. IDs, имена, роли, рабочие места и внешность из `src/config.ts` сохранены. Дополнительных работников, управления составом или установки Skills через UI нет.

| Работник | Основной Skill | Дополнительные назначения |
|---|---|---|
| Lead Developer | planning-and-task-breakdown | context-engineering, code-review-and-quality |
| UI/UX Designer | frontend-design | ui-ux-pro-max |
| Frontend Developer | vercel-react-best-practices | — |
| Backend Developer | api-and-interface-design | source-driven-development |
| SEO Specialist | seo-audit | schema, programmatic-seo |
| Security Engineer | security-and-hardening | differential-review |
| QA Engineer | test-driven-development | webapp-testing |
| Technical Reviewer | code-review-and-quality | — |

Имена и внешность работников не менялись. Точные IDs, имена и роли остаются в src/config.ts.

## Источник данных

`src/agents/registry.json` — единый каталог community Skills, восьми профилей, восьми employee-связок и обоснованных skillAssignments. Проверяются уникальные Skill IDs, GitHub repository/path/commit, роли, основные и множественные назначения. Дополнительный inspect-community-skills.mjs проверяет реальные файлы по SHA-256 lockfile; UI различает Installed, Available, Verification required и Installation failed.

В Agent сохранены skillId/skillName/skillDescription/customAgentId/responsibility и добавлен список skills с источниками, лицензиями, версиями, фактическими статусами и assignedEmployeeId. Графика остаётся в слое представления. Неустановленные кандидаты не выполняются. Полный каталог: [COMMUNITY_SKILLS_CATALOG.md](COMMUNITY_SKILLS_CATALOG.md).

## Передача работы

Lead планирует и согласует архитектуру. UI/UX выдаёт спецификацию до frontend-реализации. Frontend и Backend работают в своей области. Security и SEO дают специализированные заключения, QA проверяет фактическое поведение. Reviewer независимо оценивает завершённый diff; Lead не заменяет его заключение своим. У каждого результата должны быть доказательства, проверки, ограничения и следующий владелец.

Сохраняется mock-маршрут задачи этапа 2: Lead создаёт → Frontend получает/выполняет → QA тестирует → Reviewer проверяет → Lead принимает результат → completed. Присвоение Skill не меняет шаги, события, паузу, сброс или ручную систему задач.

На этапе 3B **ни один работник не запущен как реальный независимый процесс**. Все движения и события остаются mock. Skills и TOML — подготовленная конфигурационная основа; не соединение с runtime Codex. Инструкции вызова и поддержки: [AGENT_SKILLS.md](AGENT_SKILLS.md), [AGENT_PROFILES.md](AGENT_PROFILES.md).
