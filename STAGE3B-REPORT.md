# Stage 3B — Community Agent Skills

Перед работой выполнен git status: main синхронизирован с origin/main, дерево чистое. Установленный CLI: codex-cli 0.144.5. Исследованы все шесть одобренных репозиториев; точные commits и review scope сохранены в docs/COMMUNITY_SKILLS_CATALOG.md.

## Фактически установлено

| Работник | Установленные Skills | Источник / лицензия |
|---|---|---|
| Lead Developer | planning-and-task-breakdown; context-engineering; code-review-and-quality (предварительная проверка) | addyosmani/agent-skills — MIT |
| UI/UX Designer | frontend-design | anthropics/skills — Apache-2.0 |
| Frontend Developer | vercel-react-best-practices | vercel-labs/agent-skills — MIT, декларация в SKILL.md |
| Backend Developer | api-and-interface-design; source-driven-development | addyosmani/agent-skills — MIT |
| SEO Specialist | seo-audit; schema | coreyhaines31/marketingskills — MIT |
| Security Engineer | security-and-hardening | addyosmani/agent-skills — MIT |
| QA Engineer | test-driven-development; webapp-testing | Addy — MIT; Anthropic — Apache-2.0 |
| Technical Reviewer | code-review-and-quality (независимое ревью) | addyosmani/agent-skills — MIT |

Всего 12 уникальных установленных Skills и 13 назначений установленных Skills, поскольку review Skill обоснованно общий для Lead/Reviewer. Файлы скопированы selective-процессом встроенного Codex skill-installer из проверенных pinned clones, без upstream install scripts, npm lifecycle и глобальных plugins. License notices и необходимые references включены. Файлы приведены к точным Git blob bytes, не изменены по содержанию; .gitattributes сохраняет их без EOL-конверсии.

Для каждой установки lockfile хранит repository, sourcePath, commit и SHA-256 всех source/resources/license файлов. Двенадцать установок подтверждены фактическими файлами. Прежние восемь custom-written Skills перенесены в docs/legacy-agent-skills и не подменяют реальные Skills.

## Не установлено

- programmatic-seo, MIT: проверен, статус Available but not installed; не нужен локальному офису без публичного набора страниц.
- ui-ux-pro-max, MIT: Verification required; полный Python/data bundle и CLAUDE_PLUGIN_ROOT paths не прошли полную проверку для данного Codex-окружения; дизайн-процесс уже покрыт frontend-design.
- differential-review, CC-BY-SA-4.0: Verification required; требуется завершить проверку namespaced plugin agent/integrations и официального Codex plugin deployment. Вместо неподтверждённой установки Security получил проверенный security-and-hardening.

Нет утверждения, что весь Trail of Bits или UI Pro Max уже установлен. Для Vercel сохраняется точное ограничение проверки лицензии: MIT заявлена в SKILL.md, отдельного upstream LICENSE в выбранном commit нет.

## Приложение и файлы

Сохранены восемь employee IDs/ролей, восемь TOML-профилей, TaskSystem/EventBus/mock workflow, сцена и анимации. Нормализованный реестр расширен skillAssignments: несколько Skills на сотрудника, общие Skills только с обоснованием. Agent.skills содержит source metadata, assignedEmployeeId и фактический статус. UI показывает список и четыре отдельных состояния; источники/лицензии/commits/dependencies раскрываются по запросу.

Основные изменения:

- `.agents/skills/` — 12 выбранных upstream Skill directories; `.agents/references/` — необходимые общие references; `.agents/community-skills.lock.json` — pinned receipts.
- `.gitattributes`, `.gitignore` — точные vendor bytes и игнорирование generated evidence.
- `src/agents/registry.json`, `registry.ts`, `src/domain.ts` — каталог, множественные назначения и данные модели.
- `scripts/inspect-community-skills.mjs`, `scripts/validate_agents.py`, `package.json` — проверка наличия/целостности/YAML/TOML и predev/pretest/prebuild/prepreview.
- `src/ui/AgentSkills.tsx`, `src/ui/style.css` — отображение списка и статусов в прежней панели.
- `.codex/agents/*.toml` — ссылки на реальные Skills и сохранение границ Director/ролей.
- `tests/community.test.ts`, `tests/skills.test.ts`, `tests/test_agents_validation.py` — новые проверки и миграция прежних ожиданий к реальным Skills. Все 16 прежних тестов state/workflow сохранены без изменений.
- `docs/COMMUNITY_SKILLS_CATALOG.md`, `docs/COMMUNITY_SKILLS_RESOURCE_REVIEW.json`, docs/AGENT_SKILLS, AGENT_PROFILES, TEAM_STRUCTURE и основные документы проекта — источники, лицензии, ограничения и поддержка.

## Проверки

- npm test: **35 Node-тестов + 6 Python-тестов**, все прошли, без skipped.
- npm run validate:agents: YAML/TOML и **12/12 pinned installations** прошли.
- Проверены multiple/shared assignments, уникальные IDs, корректные repositories, неверные URLs, missing installation/reference, изменённые и лишние script files, отсутствие receipt, неверный employee и все четыре UI-состояния.
- npm run build: production build успешен; TypeScript без ошибок, 32 модуля, JS 253,64 kB (gzip 76,82 kB).
- В браузере production-сборки проверены восемь карточек, корректные installed/total counts, несколько Skills на сотрудника, Installed/Available/Verification required и источники. Installation failed проверен компонентным тестом и реальными файловыми fixtures, не выдан за существующую ошибку установки.
- Финальный browser check: workflow 8/8 после продолжения; пауза удерживала шаг. Ручная задача Backend создана, назначена, запущена, прогресс 25%, completed. Typing: running/paused/running. Сброс сохраняет Skills; на 390×844 page width не превышает viewport. Консоль: 0 ошибок/предупреждений.

## Ограничения

Полные выбранные SKILL.md прочитаны. Все вспомогательные файлы инвентаризированы и проверены сканером содержимого; все executable Python files webapp-testing прочитаны вручную. Выборочные references изучены подробно; полный semantic/security аудит всех 70 React rules и остальных примеров не заявляется. Контрольные суммы — доказательство происхождения/целостности, не доказательство безопасности рекомендаций.

Python Playwright и browser binaries не устанавливались. Сторонние scripts не исполнялись. Некоторые рекомендации относятся к Next.js/RSC или публичным сайтам и не применяются к Vite/local office. В UI установленность означает файлы Skill, а не готовность всех optional внешних инструментов. Evidence обновляется при startup/build; production bundle не является live filesystem monitor.

Реальный runtime Codex не подключён. Для discovery откройте корень AI Office в Codex и начните новый ход/сессию. Следующий этап автоматически не начинается.
