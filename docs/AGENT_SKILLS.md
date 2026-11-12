# Agent Skills — текущее состояние Stage 3B

В проекте установлены 12 реальных community Skills. Реестр содержит ещё три кандидата, которые явно не объявляются установленными. Состав команды — восемь работников; одному работнику разрешены несколько Skills, общий Skill назначается с обоснованием.

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

Полные источники, прямые GitHub-пути, лицензии, зависимости, причины выбора/отказа и точные commits: [COMMUNITY_SKILLS_CATALOG.md](COMMUNITY_SKILLS_CATALOG.md). Байты подтверждены `.agents/community-skills.lock.json`; originals сохранены без редактирования. Ранее созданные авторские Skills находятся в `docs/legacy-agent-skills/`, вне путей discovery.

## Обнаружение и применение

Откройте корень AI Office в Codex и начните новый ход/сессию. В CLI/IDE выберите Skill через `/skills` или укажите `$planning-and-task-breakdown`, `$frontend-design`, `$vercel-react-best-practices`, `$seo-audit` и другие точные имена из каталога. Стандартное проектное размещение `.agents/skills/<original-name>/SKILL.md` описано в [официальной документации](https://learn.chatgpt.com/docs/build-skills). Установленная версия CLI при проверке — 0.144.5; реальные задачи Codex в рамках офиса не запускались.

Skills доступны проекту, а не эксклюзивно одному профилю. Явные роли и основные/дополнительные назначения закреплены в реестре и TOML developer_instructions. Кандидатов без Installed не вызывайте как уже установленный функционал.

Сторонние инструкции не отменяют Director, правила проекта, ограничения исполнения, сохранение офиса и независимость Reviewer. Любой script проверяется до запуска, даже когда upstream предлагает black-box usage. Для browser control в этой среде применяется CUA. В этом этапе не запускались сторонние скрипты, не добавлялись глобальные плагины и не устанавливались дополнительные runtime-инструменты.

## Проверки

```powershell
python -m pip install --target work/validation-deps "PyYAML>=6,<7"
npm run validate:agents
npm test
npm run build
```

PyYAML — только инструмент проверки в игнорируемой work/, npm/runtime-зависимости приложения не менялись. Проверяются YAML/TOML, целостность всех установленных файлов, множественные назначения, источники и статусы. UI использует generated snapshot файловой проверки на startup/build, а не просто поле имени. После изменения файлов Skills перезапустите dev-server или пересоберите production. Preview отказывается запускаться при неполной заявленной установке.

## Поддержка и будущие Skills

Для нового Skill сначала изучите реальный SKILL, все исполняемые scripts и нужные references, license и совместимость, зафиксируйте commit. Добавьте запись в skills и обоснованную пару в skillAssignments. Меняйте primary skillId и профиль только если действительно нужен другой основной процесс. Проверьте отсутствующие установки и пересечения; обновите lockfile только после повторной проверки файлов, не для скрытия ошибки. Сохраняйте восемь работников и восемь профилей. Дополнительные Skills не требуют новых сотрудников.
