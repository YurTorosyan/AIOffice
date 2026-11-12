# Codex Custom Agent profiles

В `.codex/agents/` находятся ровно восемь проектных TOML-файлов:

| Профиль / имя Codex | Работник | Основной Skill |
|---|---|---|
| lead-developer.toml / lead-developer | lead | project-architecture |
| ui-ux-designer.toml / ui-ux-designer | design | ui-ux-design |
| frontend-developer.toml / frontend-developer | frontend | frontend-engineering |
| backend-developer.toml / backend-developer | backend | backend-engineering |
| seo-specialist.toml / seo-specialist | seo | technical-seo |
| security-engineer.toml / security-engineer | security | security-audit |
| qa-engineer.toml / qa-engineer | qa | quality-assurance |
| technical-reviewer.toml / technical-reviewer | review | independent-code-review |

Используются только три обязательных поддерживаемых поля: `name`, `description`, `developer_instructions`. Имя совпадает с именем файла без расширения и `customAgentId`. Профили не задают модель, полномочия, транспорт или выдуманное поле назначения Skill. Формат и размещение проверены по [официальной документации Custom Agents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Как использовать

Откройте корень AI Office в Codex. При наличии поддержки Custom Agents в вашей установленной версии запрос может выглядеть так:

> Используй custom agent technical-reviewer для независимого ревью завершённых изменений. Прочитай .agents/skills/independent-code-review/SKILL.md, не меняй рассматриваемый код; верни findings с серьёзностью и file:line.

Другой пример:

> Используй custom agent lead-developer для плана этой задачи. Сначала прочитай .agents/skills/project-architecture/SKILL.md, затем верни решения, задачи, владельцев и проверки. Реальный Codex runtime к офису не подключай.

Это примеры **явных будущих запросов на роль**, а не обещание, что карточка в офисе запустит соответствующий процесс. Не существует добавленного нами `/agent`-API или кнопки подключения. Запуск зависит от установленного Codex и настроек родительской сессии; сами TOML-файлы не повышают полномочия. Ограничение Reviewer на редактирование задано инструкциями, а не отдельной технической изоляцией.

## Содержание и границы

Каждый профиль указывает существующий employee ID, точную роль и путь к своему основному Skill. Он требует читать Skill перед ролью, сохранять решения Director, соблюдать границы специалистов и возвращать Lead структурированный результат: Outcome; Evidence and affected files; Checks; Risks or open decisions; Handoff owner and next action.

Technical Reviewer остаётся независимым: не реализует рассматриваемое исправление и не принимает вывод Lead на веру. Несогласие сохраняется для Director. Lead координирует передачу результатов, но не подменяет ревью. Backend учитывает, что текущий проект работает без сервера; SEO учитывает локальный характер приложения.

Все проектные Skills могут быть обнаружены любым профилем. Связь с основным Skill задаётся явными инструкциями и реестром приложения, а не автоматически при создании `SKILL.md`.

## Обновление

Сохраняйте имена и соответствия, если миграция не запрошена явно. Меняйте обязанности в соответствующих файлах и документации; при изменении назначения синхронно обновляйте `src/agents/registry.json`, текст инструкций и тесты. Проверяйте `npm run validate:agents`, `npm test`, `npm run build`. Профили этапа 3 проверены как конфигурационные артефакты; поведенческие испытания реального Codex не выполнялись и не требуются для mock-офиса.
