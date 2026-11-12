# Правила проекта

- Приложение самостоятельное. Не связывать с MASIX.
- Ровно 8 работников: Lead Developer, UI/UX Designer, Frontend Developer, Backend Developer, SEO Specialist, Security Engineer, QA Engineer, Technical Reviewer.
- Director — владелец, не работник. Не добавлять управление составом.
- Состояние, задачи и адаптер отделять от компонентов.
- Никаких выдуманных API Codex. Mock всегда явно обозначать.
- Не использовать NosytLabs Agent Office или его исходники.
- Не добавлять backend, авторизацию, облако или платежи на этапе 1.
- После законченного этапа проверить git status и сделать commit. Push только при существующем безопасном remote.
- Этапы 1 и 2 проверены владельцем; этап 3 разрешён. После этапа 3 остановиться для проверки владельцем.
- На этапе 2 не подключать реальный Codex. Сохранять внешний вид офиса и анимации. Бизнес-правила задач и событий держать вне React.
- На этапе 3 использовать `src/agents/registry.json` для основных назначений Skills/профилей. Сохранять ровно 8 работников, 8 основных Skills и 8 TOML-профилей. Документация: docs/TEAM_STRUCTURE.md, docs/AGENT_SKILLS.md, docs/AGENT_PROFILES.md.
- Профили и Skills не означают, что сотрудники уже работают как реальные агенты. Не подключать runtime Codex и не менять mock workflow. Для проверки конфигурации: npm run validate:agents; затем npm test, npm run build и browser check.
