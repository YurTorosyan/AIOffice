# Codex Custom Agent profiles — Stage 3B

Сохранены восемь проектных TOML-файлов в `.codex/agents/`. В каждом только официальные required fields: name, description, developer_instructions. Формат описан в [официальной документации](https://learn.chatgpt.com/docs/agent-configuration/subagents). Профили не создают отдельные процессы и не подключают офис к Codex runtime.

| Profile | Employee | Primary community Skill |
|---|---|---|
| lead-developer.toml | lead | planning-and-task-breakdown |
| ui-ux-designer.toml | design | frontend-design |
| frontend-developer.toml | frontend | vercel-react-best-practices |
| backend-developer.toml | backend | api-and-interface-design |
| seo-specialist.toml | seo | seo-audit |
| security-engineer.toml | security | security-and-hardening |
| qa-engineer.toml | qa | test-driven-development |
| technical-reviewer.toml | review | code-review-and-quality |

Developer instructions явно ссылаются на установленный основной Skill, дополнительные назначения берутся из единого реестра. Только Installed означает допустимый локальный источник инструкций; кандидаты Available/Verification required ещё не установлены и не должны автоматически скачиваться или запускаться. Указание стороннего Skill не повышает permissions и не разрешает выполнение чужих scripts без инспекции.

Откройте корень AI Office в Codex. Пример будущего запроса: «Используй custom agent technical-reviewer для независимого ревью готового diff; основной Skill code-review-and-quality; не меняй рассматриваемое рабочее дерево». Это явный запрос на роль, а не кнопка runtime внутри офиса. Для примера upstream mutation experiment используйте только изолированную временную копию. Lead может применять тот же review Skill для предварительной самопроверки, но не заменяет независимое заключение Reviewer.

Director остаётся владельцем. Текущий внешний вид, восемь работников, архитектура состояния и mock workflow сохраняются. Backend не добавляется без реальной задачи; SEO не публикует локальное приложение; QA не выдаёт установку Playwright-примеров за готовое внешнее окружение.

Обновляйте registry, профиль и каталог согласованно. После изменения выполните npm run validate:agents, npm test, npm run build и browser check. Профили остаются конфигурацией, их реальная эффективность в Codex не тестировалась на этом этапе.
