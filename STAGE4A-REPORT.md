# Stage 4A — Real Codex Lead pilot

## Результат

Существующий Lead Developer выполнил реальное read-only задание через локальный мост. Он изучил разрешённые снимки проекта и свой TOML-профиль, применил три community Skills и вернул структурированный план. Codex подтвердил `turn/completed` со статусом `completed`. Другие семь сотрудников не подключены; следующий этап не начат.

Mock остаётся стартовым режимом. Состав, сцена, персонажи и анимации сохранены; `Office.tsx`, TaskSystem, MockTeamWorkflow, registry и vendor Skills не менялись.

## Реальная проверка

| Проверка | Результат |
|---|---|
| CLI | **codex-cli 0.144.5**; изучены version/help/app-server help и сгенерированные stable JSON schemas |
| Среда | Node 24.18, npm, React 19.2.8, TypeScript ~5.9.3, Vite 8.1.5 |
| Метод | **app-server по stdio**, отдельный локальный Node bridge; SDK оценён как вариант серверной автоматизации |
| Причина выбора | Поддержка lifecycle, streamed events, approvals и interrupt; без экспериментального WebSocket listener Codex |
| Авторизация | `codex login status`: Logged in using ChatGPT; затем реальный `account/read` подтвердил account |
| Мост | Запущен пользователем в обычном PowerShell, **127.0.0.1:8787** |
| Skills | Реальный `skills/list`: enabled, exact name и canonical path для **planning-and-task-breakdown**, **context-engineering**, **code-review-and-quality** |
| Вызов Skills | Все три явно отправлены как skill inputs; применение описано в реальном итоговом ответе |
| Профиль | Реальные developer_instructions существующего lead-developer.toml переданы root thread; сам TOML включён в снимки и изучен моделью |
| Политика | readOnly, networkAccess false для инструментов, approvalPolicy on-request, approvalsReviewer user, ephemeral thread |
| Успешное задание | 12 фиксированных полных SHA-256 снимков; **25 событий**, **0 commandExecution items** |
| Завершение | Реальный completed turn; после проверенного disconnect состояние **disconnected · completed**, 26 событий |
| Исходники | SHA-256 всех **190 файлов** до/после задания совпали; новых/изменённых исходных файлов нет |

В stable ThreadStartParams этой версии нет выбора named root-agent. Применение профиля здесь **явное**, а не автоматический выбор subagent. Никого дополнительно не создавали.

Полученные методы событий: runtime/connected, task/submitted, thread/started, turn/started, item/started, item/completed, item/agentMessage/delta, turn/plan/updated, turn/completed. Счётчики, hashes и исходные timestamps runtime сохранены в [STAGE4A_EVIDENCE.json](docs/STAGE4A_EVIDENCE.json). Реальный ответ: [STAGE4A_PILOT_RESULT.md](docs/STAGE4A_PILOT_RESULT.md). Сохранение этих артефактов выполнил разработчик после read-only задания.

Первый реальный turn вернул честный ответ о блокировке: вложенный Windows sandbox не смог запустить чтение из-за отсутствующего helper. Реальный command approval перевёл офис в Waiting, был отклонён без расширения прав. Этот ответ не засчитан успешным planning pilot. Затем мост получил передачу фиксированного контекста; повторный запуск завершил планирование без shell и новых разрешений.

Запуск app-server из среды разработчика отдельно упирался в доступ Windows к служебным файлам Codex. Пользователь запустил мост своим обычным аккаунтом. Auth-файлы не копировались, ACL не менялись, sandbox не отключался. Мост не читает credential files и не передаёт account identity, tokens или env-значения браузеру.

## Архитектура и безопасность

`UI → CodexAdapter → RealCodexAdapter → нормализованный HTTP-контракт → LeadPilot → AppServerRpc → codex app-server`.

Состояние, задачи, события, task lifecycle и policy находятся вне React. Progress неопределён до подтверждённого завершения; таймер не создаёт проценты. Подписчики получают новые реальные события один раз и в порядке runtime; обновления состояния при опросе отделены от событий.

Loopback-only, Host/Origin checks, CSRF nonce, ограничения JSON и фиксированный список действий. Нет generic shell/RPC/prompt/path/model endpoints. Запросы прав можно отклонить или остановить; автоматических grants и постоянных allow rules нет. Снимки ограничены 12 разрешёнными путями внутри проекта и размером 200 kB. Результат отображается как текст.

Официальные источники, проверенные схемы, запуск и ограничения: [CODEX_RUNTIME.md](docs/CODEX_RUNTIME.md).

## Проверки

- **56 Node + 6 Python — PASS**. Сохранены все прежние проверки. Добавлены CLI/version/availability, connect/auth/discovery failure, profile/Skills/context, thread/task policy, JSONL, events/status/result, optional phase, approvals, interrupt confirmation, disconnect/process exit, hostile HTTP/CSRF, shared adapter, fetch binding и отсутствие повторных событий.
- `npm run validate:agents` — PASS: восемь профилей/работников, 12/12 pinned установок, три кандидата остаются неустановленными.
- Production build — PASS: TypeScript и Vite, 35 modules. JS 262.68 kB, gzip 79.18 kB. Новых npm-зависимостей нет.
- Browser: реальный connect → task → plan → result → confirmed completed → disconnect. Только один активный работник; остальные семь idle. Waiting/deny проверены первым реальным запуском.
- Mock: workflow **8/8**, pause/resume/reset; ручная задача Backend → working → 25% → completed. Источники mock/codex различимы; reload начинает с mock. Mock не требует установленного Codex или моста.
- Mobile **390×844**, document width **375**, переполнения страницы нет; сцена сохраняет прокрутку. Console errors/warnings **0/0**. Скриншот успешного состояния: [stage4a-browser.jpg](docs/stage4a-browser.jpg).
- Дополнительное реальное задание для interrupt не запускалось: автоматическая approval-проверка отклонила его как выход за согласованный pilot. Interrupt проверен fixtures; реальное отключение проверено в браузере. Обход запрета не предпринимался.

После возобновления старая временная копия PyYAML была недоступна по правам Windows. Для финальных тестов установлен PyYAML 6.0.3 в игнорируемую `work/validation-deps-stage4a`, а `PYTHONPATH` указывал на эту папку только в процессе проверки. Настройки доступа и зависимости приложения не менялись. Финальная сборка после исправления подписок также проверена в браузере на сохранённом результате, без нового задания Codex.

## Файлы

- `server/rpc.mjs`, `pilot.mjs`, `http.mjs`: изолированный мост, протокол, контекст, policy и lifecycle.
- `src/integration/RealCodexAdapter.ts`, `runtime.ts`, комментарий `CodexAdapter.ts`; `src/domain.ts`: общий контракт, проекция состояния, codex source и неопределённый progress.
- `src/ui/useOffice.ts`, `App.tsx`, `RuntimePanel.tsx`, `TaskPanel.tsx`, `AgentSkills.tsx`, `style.css`: минимальные элементы pilot и сохранение mock.
- `vite.config.ts`, `package.json`: dev proxy, команда bridge, test runner.
- `.codex/agents/lead-developer.toml`: узкое разрешение Stage 4A, прежняя роль и Skills сохранены. Семь других профилей не менялись.
- `tests/runtime.test.mjs`, `runtime-adapter.test.ts`: runtime/security/regression проверки.
- `AGENTS.md`, `PROJECT.md`, `ARCHITECTURE.md`, `README.md`, `docs/AGENT_PROFILES.md`, `AGENT_SKILLS.md`, `CODEX_RUNTIME.md`, evidence/result и этот отчёт: scope, запуск, доказательства и ограничения.

## Git и ограничения

Перед изменениями Git был чист, main совпадал с origin/main. Commit message: `feat: add local Codex runtime integration pilot`. Финальный hash и результат push сообщаются владельцу после создания коммита, а не подставляются заранее в коммитируемый файл.

App-server экспериментальный, мост ограничен проверенной CLI 0.144.5. Только один Lead и фиксированное read-only задание. Контекст получен моделью как снимки от моста, не через shell; общий запуск инструментов во вложенном Windows sandbox этим пилотом не доказан. Read-only не является per-project read allowlist и не превращает приложение в общую систему изоляции секретов. Собственная конфигурация, сеть и служебное состояние Codex остаются в его runtime.

Состояние и последний результат хранятся в памяти; reload браузера не останавливает runtime, restart очищает историю. Grants, запись, остальные сотрудники и реальный командный workflow не подключены. План Lead — предложение для Director; следующий этап требует отдельного разрешения.
