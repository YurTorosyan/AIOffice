# Community Skills Catalog — Stage 3B

Проверены шесть одобренных GitHub-репозиториев. Установлены только 12 выбранных Skills, а не целые коллекции. Команда по-прежнему состоит ровно из восьми работников; восемь TOML-профилей сохранены. Источник назначений — `src/agents/registry.json`; один Skill может быть общим, а у одного работника может быть несколько Skills.

## Метод проверки и установки

- Установлен Codex CLI **0.144.5** (`codex --version`). Для выбранных Skills проверены стандартные YAML name/description, локальное размещение и отсутствие обязательного vendor runtime. Это проверка формата и требований окружения, а не запуск реальных агентов.
- Репозитории получены Git clone в игнорируемую `work/community-sources`. Прочитан полный SKILL.md каждого установленного Skill. Дополнительные файлы перечислены, прочитаны сканером содержимого и проверены на исполняемые операции/внешние зависимости; вручную полностью прочитаны все четыре Python-файла webapp-testing, hardening-patterns и выборочные React references. Это ограниченная проверка содержания, не полный security-аудит каждого примера и каждой рекомендации.
- Использованы проверенные функции `_validate_skill` и `_copy_skill` из встроенного Codex skill-installer: копирование только выбранных папок из уже проверенных, закреплённых clone. Upstream install scripts, hooks, npm lifecycle и сторонний CLI не запускались. `npx skills add` не понадобился; глобальные Codex plugins не регистрировались.
- Оригинальные файлы выбранных Skills не менялись. Скопированы исходные лицензии; для Addy сохранены необходимые общие references в `.agents/references`, чтобы относительные ссылки продолжали работать. У Vercel MIT объявлена в SKILL.md; отдельного LICENSE-файла в закреплённом upstream нет — это явно учитывается как источник декларации лицензии.
- `.agents/community-skills.lock.json` хранит полный commit, исходные пути и SHA-256 каждого установленного файла, включая лицензии и общие references. При копировании байты сравнивались с закреплёнными Git-исходниками.
- Старые восемь авторских Skills не удалены из истории: перенесены в `docs/legacy-agent-skills/` и больше не являются discoverable Skills проекта. Профили ссылаются на реальные основные Skills и сохраняют ограничения Director, независимость Reviewer и текущий дизайн.

## Реальные назначения

- **Lead Developer** (`lead`): `planning-and-task-breakdown`, `context-engineering`, `code-review-and-quality`.
- **UI/UX Designer** (`design`): `frontend-design`, `ui-ux-pro-max`.
- **Frontend Developer** (`frontend`): `vercel-react-best-practices`.
- **Backend Developer** (`backend`): `api-and-interface-design`, `source-driven-development`.
- **SEO Specialist** (`seo`): `seo-audit`, `schema`, `programmatic-seo`.
- **Security Engineer** (`security`): `security-and-hardening`, `differential-review`.
- **QA Engineer** (`qa`): `test-driven-development`, `webapp-testing`.
- **Technical Reviewer** (`review`): `code-review-and-quality`.

`code-review-and-quality` обоснованно общий для Lead и Technical Reviewer: Lead выполняет предварительную самопроверку, Reviewer остаётся независимым и не подменяется мнением Lead. Любой mutation experiment из upstream выполняется только на изолированной копии, а не в рассматриваемом рабочем дереве. Для UI/UX действующий пиксельный дизайн имеет приоритет над общими рекомендациями о новом визуальном направлении. Для SEO отсутствие публичного сайта означает, что индексирование, Search Console и публикация сейчас неприменимы.

## Каталог

### planning-and-task-breakdown

- Employee: Lead Developer.
- Original Skill name: `planning-and-task-breakdown`; UI: Планирование и декомпозиция.
- Repository: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
- Direct GitHub path: [skills/planning-and-task-breakdown](https://github.com/addyosmani/agent-skills/tree/301b02b12bff98e4688e6984af6556802322bbde/skills/planning-and-task-breakdown).
- License: [MIT](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/LICENSE).
- Purpose: Порядок задач, зависимости и проверяемые критерии.
- Why assigned: Planning/context ownership; code review is a pre-handoff self-check and does not replace Technical Reviewer.
- Dependencies: Git and repository test/build tools (when invoked)
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/planning-and-task-breakdown/SKILL.md` (файл действительно установлен).
- Source commit: `301b02b12bff98e4688e6984af6556802322bbde`. Installed version: `301b02b12bff98e4688e6984af6556802322bbde`.
- Evidence: 3 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority.

### context-engineering

- Employee: Lead Developer.
- Original Skill name: `context-engineering`; UI: Context Engineering.
- Repository: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
- Direct GitHub path: [skills/context-engineering](https://github.com/addyosmani/agent-skills/tree/301b02b12bff98e4688e6984af6556802322bbde/skills/context-engineering).
- License: [MIT](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/LICENSE).
- Purpose: Отбор проектного контекста и передача работы между сессиями.
- Why assigned: Planning/context ownership; code review is a pre-handoff self-check and does not replace Technical Reviewer.
- Dependencies: Git and repository test/build tools (when invoked)
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/context-engineering/SKILL.md` (файл действительно установлен).
- Source commit: `301b02b12bff98e4688e6984af6556802322bbde`. Installed version: `301b02b12bff98e4688e6984af6556802322bbde`.
- Evidence: 2 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority.

### frontend-design

- Employee: UI/UX Designer.
- Original Skill name: `frontend-design`; UI: Frontend Design.
- Repository: [anthropics/skills](https://github.com/anthropics/skills).
- Direct GitHub path: [skills/frontend-design](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/frontend-design).
- License: [Apache-2.0](https://github.com/anthropics/skills/blob/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/frontend-design/LICENSE.txt).
- Purpose: Осмысленный дизайн интерфейсов с учётом существующего визуального направления.
- Why assigned: Design direction within the approved office identity; large design-search bundle remains unverified.
- Dependencies: None beyond project tools/context.
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/frontend-design/SKILL.md` (файл действительно установлен).
- Source commit: `2c5958ecac7cee2b583967a2c4981d0f4a75c579`. Installed version: `2c5958ecac7cee2b583967a2c4981d0f4a75c579`.
- Evidence: 2 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority. May propose strong visual changes; preserve the approved pixel-art office unless Director explicitly requests redesign.

### vercel-react-best-practices

- Employee: Frontend Developer.
- Original Skill name: `vercel-react-best-practices`; UI: Vercel React Best Practices.
- Repository: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills).
- Direct GitHub path: [skills/react-best-practices](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices).
- License: [MIT](https://github.com/vercel-labs/agent-skills/blob/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices/SKILL.md).
- Purpose: Практики React: эффекты, рендеринг, загрузка и производительность.
- Why assigned: React performance and maintainability in the existing Vite application.
- Dependencies: React project context; Next.js-specific advice applies only to Next.js
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/vercel-react-best-practices/SKILL.md` (файл действительно установлен).
- Source commit: `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`. Installed version: `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`.
- Evidence: 76 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority. MIT is explicitly declared in SKILL.md; upstream has no separate root LICENSE at this commit. Some rules target Next.js/RSC and must not add those frameworks to this Vite app.

### api-and-interface-design

- Employee: Backend Developer.
- Original Skill name: `api-and-interface-design`; UI: API and Interface Design.
- Repository: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
- Direct GitHub path: [skills/api-and-interface-design](https://github.com/addyosmani/agent-skills/tree/301b02b12bff98e4688e6984af6556802322bbde/skills/api-and-interface-design).
- License: [MIT](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/LICENSE).
- Purpose: Стабильные контракты API, интерфейсов модулей и ошибок.
- Why assigned: Contract-first API/interface design plus official-source verification; no unrequested backend.
- Dependencies: Git and repository test/build tools (when invoked)
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/api-and-interface-design/SKILL.md` (файл действительно установлен).
- Source commit: `301b02b12bff98e4688e6984af6556802322bbde`. Installed version: `301b02b12bff98e4688e6984af6556802322bbde`.
- Evidence: 2 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority.

### source-driven-development

- Employee: Backend Developer.
- Original Skill name: `source-driven-development`; UI: Source-Driven Development.
- Repository: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
- Direct GitHub path: [skills/source-driven-development](https://github.com/addyosmani/agent-skills/tree/301b02b12bff98e4688e6984af6556802322bbde/skills/source-driven-development).
- License: [MIT](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/LICENSE).
- Purpose: Проверка подходов по официальной документации текущих версий.
- Why assigned: Contract-first API/interface design plus official-source verification; no unrequested backend.
- Dependencies: Git and repository test/build tools (when invoked)
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/source-driven-development/SKILL.md` (файл действительно установлен).
- Source commit: `301b02b12bff98e4688e6984af6556802322bbde`. Installed version: `301b02b12bff98e4688e6984af6556802322bbde`.
- Evidence: 2 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority.

### seo-audit

- Employee: SEO Specialist.
- Original Skill name: `seo-audit`; UI: SEO Audit.
- Repository: [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills).
- Direct GitHub path: [skills/seo-audit](https://github.com/coreyhaines31/marketingskills/tree/1f837447b20bb6f0e72d87b80ece1c221c362c7d/skills/seo-audit).
- License: [MIT](https://github.com/coreyhaines31/marketingskills/blob/1f837447b20bb6f0e72d87b80ece1c221c362c7d/LICENSE).
- Purpose: Технический SEO-аудит, семантика, метаданные и индексируемость.
- Why assigned: Audit and accurate schema; programmatic SEO is optional for a future public site.
- Dependencies: Authorized browser/public-page context for online checks
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/seo-audit/SKILL.md` (файл действительно установлен).
- Source commit: `1f837447b20bb6f0e72d87b80ece1c221c362c7d`. Installed version: `1f837447b20bb6f0e72d87b80ece1c221c362c7d`.
- Evidence: 10 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority.

### schema

- Employee: SEO Specialist.
- Original Skill name: `schema`; UI: Schema Markup.
- Repository: [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills).
- Direct GitHub path: [skills/schema](https://github.com/coreyhaines31/marketingskills/tree/1f837447b20bb6f0e72d87b80ece1c221c362c7d/skills/schema).
- License: [MIT](https://github.com/coreyhaines31/marketingskills/blob/1f837447b20bb6f0e72d87b80ece1c221c362c7d/LICENSE).
- Purpose: Корректная структурированная разметка для реального контента.
- Why assigned: Audit and accurate schema; programmatic SEO is optional for a future public site.
- Dependencies: Authorized browser/public-page context for online checks
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/schema/SKILL.md` (файл действительно установлен).
- Source commit: `1f837447b20bb6f0e72d87b80ece1c221c362c7d`. Installed version: `1f837447b20bb6f0e72d87b80ece1c221c362c7d`.
- Evidence: 4 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority.

### security-and-hardening

- Employee: Security Engineer.
- Original Skill name: `security-and-hardening`; UI: Security and Hardening.
- Repository: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
- Direct GitHub path: [skills/security-and-hardening](https://github.com/addyosmani/agent-skills/tree/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening).
- License: [MIT](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/LICENSE).
- Purpose: Границы доверия, валидация и проверка рисков зависимостей.
- Why assigned: Threat modeling and hardening; differential plugin remains pending verification.
- Dependencies: Git and repository test/build tools (when invoked)
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/security-and-hardening/SKILL.md` (файл действительно установлен).
- Source commit: `301b02b12bff98e4688e6984af6556802322bbde`. Installed version: `301b02b12bff98e4688e6984af6556802322bbde`.
- Evidence: 4 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority.

### test-driven-development

- Employee: QA Engineer.
- Original Skill name: `test-driven-development`; UI: Test-Driven Development.
- Repository: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
- Direct GitHub path: [skills/test-driven-development](https://github.com/addyosmani/agent-skills/tree/301b02b12bff98e4688e6984af6556802322bbde/skills/test-driven-development).
- License: [MIT](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/LICENSE).
- Purpose: Проверяемое поведение через цикл red–green–refactor.
- Why assigned: TDD and browser-testing methodology; external Playwright examples are optional and not executed.
- Dependencies: Git and repository test/build tools (when invoked)
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/test-driven-development/SKILL.md` (файл действительно установлен).
- Source commit: `301b02b12bff98e4688e6984af6556802322bbde`. Installed version: `301b02b12bff98e4688e6984af6556802322bbde`.
- Evidence: 3 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority.

### webapp-testing

- Employee: QA Engineer.
- Original Skill name: `webapp-testing`; UI: Webapp Testing.
- Repository: [anthropics/skills](https://github.com/anthropics/skills).
- Direct GitHub path: [skills/webapp-testing](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/webapp-testing).
- License: [Apache-2.0](https://github.com/anthropics/skills/blob/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/webapp-testing/LICENSE.txt).
- Purpose: Сценарии тестирования веб-приложений и примеры Python Playwright.
- Why assigned: TDD and browser-testing methodology; external Playwright examples are optional and not executed.
- Dependencies: Python + Playwright + browser binaries for the bundled examples (not installed in this stage)
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/webapp-testing/SKILL.md` (файл действительно установлен).
- Source commit: `2c5958ecac7cee2b583967a2c4981d0f4a75c579`. Installed version: `2c5958ecac7cee2b583967a2c4981d0f4a75c579`.
- Evidence: 6 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority. with_server.py uses shell=True for user-supplied server commands; examples contain Linux output paths. Never run blind; use supported CUA browser tooling in this environment.

### code-review-and-quality

- Employee: Lead Developer, Technical Reviewer.
- Original Skill name: `code-review-and-quality`; UI: Code Review and Quality.
- Repository: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
- Direct GitHub path: [skills/code-review-and-quality](https://github.com/addyosmani/agent-skills/tree/301b02b12bff98e4688e6984af6556802322bbde/skills/code-review-and-quality).
- License: [MIT](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/LICENSE).
- Purpose: Ревью корректности, архитектуры, безопасности и качества кода.
- Why assigned: Planning/context ownership; code review is a pre-handoff self-check and does not replace Technical Reviewer. Independent five-axis review; do not implement the changes under review.
- Dependencies: Git and repository test/build tools (when invoked)
- Installation status: **Installed — файлы присутствуют и проверены**.
- Local path: `.agents/skills/code-review-and-quality/SKILL.md` (файл действительно установлен).
- Source commit: `301b02b12bff98e4688e6984af6556802322bbde`. Installed version: `301b02b12bff98e4688e6984af6556802322bbde`.
- Evidence: 4 файлов в pinned SHA-256 receipt.
- Verification: Complete SKILL.md read; complete resource inventory/content scan; executable scripts inspected before copying. Codex CLI 0.144.5 standard Skill format checked; not runtime-executed.
- Risks/boundaries: Instructions are third-party content; Director scope and existing project rules take priority. Upstream suggests mutation experiments; Technical Reviewer may only use an isolated copy, never edit the reviewed working tree. Lead self-review cannot replace independent review.

### programmatic-seo

- Employee: SEO Specialist.
- Original Skill name: `programmatic-seo`; UI: Programmatic SEO.
- Repository: [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills).
- Direct GitHub path: [skills/programmatic-seo](https://github.com/coreyhaines31/marketingskills/tree/1f837447b20bb6f0e72d87b80ece1c221c362c7d/skills/programmatic-seo).
- License: [MIT](https://github.com/coreyhaines31/marketingskills/blob/1f837447b20bb6f0e72d87b80ece1c221c362c7d/LICENSE).
- Purpose: Построение полезных SEO-страниц на основе шаблонов и данных.
- Why assigned: Audit and accurate schema; programmatic SEO is optional for a future public site.
- Dependencies: See verification notes; no optional tooling installed.
- Installation status: **Available but not installed**.
- Local path: `.agents/skills/programmatic-seo/SKILL.md` (папка не установлена).
- Source commit: `1f837447b20bb6f0e72d87b80ece1c221c362c7d`. Installed version: `not installed`.
- Verification: Verified instruction-only Skill and references; intentionally not installed: this local office has no public pages at scale.
- Risks/boundaries: Verified instruction-only Skill and references; intentionally not installed: this local office has no public pages at scale.

### ui-ux-pro-max

- Employee: UI/UX Designer.
- Original Skill name: `ui-ux-pro-max`; UI: UI/UX Pro Max.
- Repository: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
- Direct GitHub path: [.claude/skills/ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/6ae86f61f520d6ca229d2f40e070410638c908c5/.claude/skills/ui-ux-pro-max).
- License: [MIT](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/6ae86f61f520d6ca229d2f40e070410638c908c5/LICENSE).
- Purpose: Поисковая база дизайн-систем и UI/UX-рекомендаций.
- Why assigned: Design direction within the approved office identity; large design-search bundle remains unverified.
- Dependencies: See verification notes; no optional tooling installed.
- Installation status: **Verification required**.
- Local path: `.agents/skills/ui-ux-pro-max/SKILL.md` (папка не установлена).
- Source commit: `6ae86f61f520d6ca229d2f40e070410638c908c5`. Installed version: `not installed`.
- Verification: SKILL and license read; Python search/data bundle not fully verified for this Codex installation. CLAUDE_PLUGIN_ROOT paths need adaptation; overlaps selected frontend-design.
- Risks/boundaries: SKILL and license read; Python search/data bundle not fully verified for this Codex installation. CLAUDE_PLUGIN_ROOT paths need adaptation; overlaps selected frontend-design.

### differential-review

- Employee: Security Engineer.
- Original Skill name: `differential-review`; UI: Differential Review.
- Repository: [trailofbits/skills](https://github.com/trailofbits/skills).
- Direct GitHub path: [plugins/differential-review/skills/differential-review](https://github.com/trailofbits/skills/tree/149d7b21f4067765b82e67029730b42d228ef4b4/plugins/differential-review/skills/differential-review).
- License: [CC-BY-SA-4.0](https://github.com/trailofbits/skills/blob/149d7b21f4067765b82e67029730b42d228ef4b4/LICENSE).
- Purpose: Специализированное security-ревью изменений по Git-истории.
- Why assigned: Threat modeling and hardening; differential plugin remains pending verification.
- Dependencies: See verification notes; no optional tooling installed.
- Installation status: **Verification required**.
- Local path: `.agents/skills/differential-review/SKILL.md` (папка не установлена).
- Source commit: `149d7b21f4067765b82e67029730b42d228ef4b4`. Installed version: `not installed`.
- Verification: SKILL and repository Codex installation instructions inspected. References namespaced adversarial-modeler/plugin integrations not installed; complete plugin dependency review is pending.
- Risks/boundaries: SKILL and repository Codex installation instructions inspected. References namespaced adversarial-modeler/plugin integrations not installed; complete plugin dependency review is pending.

## Не установленные варианты и оставшиеся пробелы

- `programmatic-seo` (MIT) проверен как instruction-only Skill и references, но не установлен: у локального офиса нет публичного набора SEO-страниц. Это доступный кандидат, не исполняемый функционал.
- `ui-ux-pro-max` (MIT): прочитаны полный SKILL.md, лицензия и требования. Большой Python/data bundle и пути `${CLAUDE_PLUGIN_ROOT}` ещё требуют полной проверки/адаптации для этого проекта. Нужный дизайн-процесс уже покрыт frontend-design; версия остаётся Verification required, не Installed.
- Trail of Bits `differential-review` (CC-BY-SA-4.0): прочитаны SKILL, лицензия репозитория и официальная Codex-инструкция установки плагина. Skill ссылается на namespaced adversarial-modeler и дополнительные интеграции; полный plugin dependency review не завершён. Не подключён и не объявлен установленным. Для Security установлен подходящий `security-and-hardening`.
- В Marketing Skills нет директории `schema-markup` на выбранном commit: фактический Skill называется **schema**; установлен именно он.
- Для `webapp-testing` установлены файлы Skill и examples. Python Playwright и browser binaries отдельно не устанавливались; его примеры содержат Linux output paths. `with_server.py` использует shell=True, поэтому команда сервера требует проверки; upstream предложение запускать скрипты как black box не отменяет требование Director сначала прочитать исходник. Для browser check используется уже доступный CUA, а не эти скрипты.
- Некоторые upstream Skills ссылаются на другие Skills для дополнительных тем. Эти optional ссылки не означают, что вся коллекция установлена. Ключевые локальные references, требуемые выбранными Skills, сохранены.
- Skills — сторонние инструкции, не доказательство отсутствия уязвимостей и не разрешение на выполнение произвольного кода. Полный runtime/effectiveness test реальных Codex-агентов не выполнялся.

## Статусы и фактическое наличие

`installed`, `available`, `verification_required`, `installation_failed` отображаются раздельно. Имена в реестре недостаточно: `scripts/inspect-community-skills.mjs` проверяет локальные файлы по lockfile, включая дополнительные scripts/references, и не выполняет их. Отсутствующий файл даёт Installation failed; несовпадающий hash, лишний файл или отсутствующий receipt — Verification required. Статус кандидата не повышается автоматически при появлении папки.

`npm run dev`, `npm test` и `npm run build` обновляют игнорируемый `src/agents/installation-state.generated.json`. UI использует именно результат проверки. Production build не проходит, если заявленная установка неполная. Production UI содержит снимок проверки на момент build: после изменений файлов Skills перезапустите dev-server или пересоберите приложение; браузер не читает файловую систему в реальном времени. Preview также проверяет наличие перед запуском.

## Обновление и восстановление

1. Выберите новый конкретный upstream commit и заново изучите полный SKILL, изменённые scripts/references и лицензию. Не обновляйте по плавающему main без проверки.
2. Обновите только нужные файлы и сохраните upstream notices. Изменение контрольных сумм допустимо только после повторной проверки содержания и происхождения.
3. Синхронизируйте registry, назначения и TOML, затем обновите pinned receipt. Не заменяйте IDs работников и не создавайте новый состав.
4. Выполните `npm run validate:agents`, `npm test`, `npm run build` и browser check.
5. Для восстановления случайно удалённой установки верните только соответствующие отслеживаемые файлы из проверенного Git-коммита и снова запустите проверку; не редактируйте статус на Installed вручную.

## Проверенные репозитории

- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills/tree/301b02b12bff98e4688e6984af6556802322bbde) — `301b02b12bff98e4688e6984af6556802322bbde`.
- [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62) — `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`.
- [anthropics/skills](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579) — `2c5958ecac7cee2b583967a2c4981d0f4a75c579`.
- [trailofbits/skills](https://github.com/trailofbits/skills/tree/149d7b21f4067765b82e67029730b42d228ef4b4) — `149d7b21f4067765b82e67029730b42d228ef4b4`.
- [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/tree/1f837447b20bb6f0e72d87b80ece1c221c362c7d) — `1f837447b20bb6f0e72d87b80ece1c221c362c7d`.
- [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/6ae86f61f520d6ca229d2f40e070410638c908c5) — `6ae86f61f520d6ca229d2f40e070410638c908c5`.
