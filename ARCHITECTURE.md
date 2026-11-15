# Архитектура

## Stage 4C — текущая архитектура

UI → CodexAdapter → RealCodexAdapter → фиксированный loopback HTTP-контракт → TeamRuntime → восемь изолированных экземпляров CheckpointPilot → отдельный AppServerRpc/process на сотрудника. Имя LeadPilot сохранено для совместимости тестов, но его lifecycle параметризован ID, ролью, существующим TOML-профилем, фиксированным заданием и проверенными Skills.

Каждое новое явное задание Director создаёт собственный persistent thread. Возобновление возвращается в исходный owned thread или восстанавливает контекст той же задачи. Истории и результаты между сотрудниками не передаются. TeamRuntime ограничивает только число одновременно активных запусков (2, или 1 через AI_OFFICE_MAX_ACTIVE); очереди, распределения задач и Stage 5 нет.

EmployeeCheckpointStorage синхронно сливает раздел одного владельца в прежний атомарный recovery.json. Проверяются agent/task/thread, сохранены данные Stage 4B. Краткие Windows EPERM/EACCES/EBUSY/EEXIST при замене файла обрабатываются ограниченными повторами без удаления живого файла. Mock восстанавливает независимые checkpoints всех сотрудников; его события и сессии явно помечены mock.

Только read-only снимки фиксированных файлов. Профиль передаётся явно, Skills — маркерами и skill input при запуске и resume. Для реальных thread выключены shell_tool, multi_agent, apps, plugins, hooks, автоматическая установка MCP-зависимостей, memories и web_search. Sandbox остаётся read-only, networkAccess=false, approvalPolicy=on-request, approvalsReviewer=user; мост разрешает только отказ или остановку запроса дополнительных прав.

Утверждённые изображения public/art не меняются. Карточка и рабочее место отображают фактические connection/execution/thread, mock отделён. Подробности и ограничения: docs/TEAM_RUNTIME.md. Следующие разделы — история предыдущих этапов, включая действовавшее тогда ограничение Lead-only.

## Текущий Stage 4B

Director разрешил Pause, Checkpoint и Resume только существующего Lead Developer поверх Stage 4A. Реальные потоки сохраняются; мост хранит проверяемые контрольные точки локально в игнорируемой .ai-office/recovery.json. Сам агент по-прежнему выполняет только read-only планирование по фиксированным снимкам, без shell/сети/записи/новых сотрудников. Mock явно отделён, сохраняет checkpoints в localStorage. Пауза ждёт подтверждения runtime; неизвестный исход и обрыв связи сохраняются для восстановления, не объявляются успехом или лимитом. Источник лимита — только проверенный CodexErrorInfo, не таймаут. Никаких ключей/токенов/паролей, новых grants или generic endpoints. Сохранять восемь работников, интерьер, анимации, Skills и mock. Проверить сценарии A–E; после коммита остановиться, Stage 4C не начинать. Детали: docs/CHECKPOINTS.md. Ниже — история предыдущих этапов.

## Stage 4A — локальный Lead pilot

UI → общий CodexAdapter → RealCodexAdapter → нормализованный локальный HTTP-контракт → LeadPilot → AppServerRpc → официальный codex app-server по stdio. HTTP-мост слушает только 127.0.0.1:8787, не публикует generic RPC/shell и не получает ключи от браузера. Состояния/задачи/события проецируются вне React; runtime progress неопределён до подтверждённого завершения. Семь сотрудников остаются idle. MockCodexAdapter и TaskSystem сохраняются.

RuntimeSnapshot отделён от wire protocol Codex. Транспорт stdio проверен по схемам CLI 0.144.5; другой CLI отклоняется до проверки. Профиль Lead явно загружается из существующего TOML в developerInstructions, а не выбирается выдуманным параметром имени агента. Три installed Skills подтверждаются receipts, затем реальным skills/list; turn получает явные skill inputs. Только turn/completed с completed означает успех. Ошибки, waiting/approval, запрос interrupt и disconnect имеют отдельные состояния.

Полный жизненный цикл, sandbox/approval boundaries, запуск и ограничения: docs/CODEX_RUNTIME.md. Stage 4A не подключает других сотрудников и не запускает следующий этап. Ниже — историческое состояние.

## Stage 3B — текущий community-каталог

Восемь работников/профилей сохранены. Registry расширен нормализованными skillAssignments (skillId, assignedEmployeeId, justification): несколько Skills на работника и обоснованное общее назначение. Сейчас 12 установленных Skills из четырёх upstream-репозиториев и три неустановленных кандидата; прежние локальные Skills архивированы в docs/legacy-agent-skills.

Каждый Skill хранит original name, GitHub repository/path, лицензию и её источник, точный sourceCommit, installedVersion, статус, зависимости и ограничения. Agent сохраняет прежние primary-поля и дополнен списком skills с assignedEmployeeId. UI не содержит дублирующей таблицы назначений.

Физические файлы подтверждаются .agents/community-skills.lock.json (upstream Git blobs + SHA-256 всех установленных ресурсов). .gitattributes запрещает преобразование переводов строк у vendor-файлов. inspect-community-skills.mjs читает только локальные файлы, обнаруживает отсутствующие/изменённые/лишние файлы и не выполняет чужой код. Generated evidence обновляется перед dev/test/build и используется моделью. Production build/preview отказываются продолжать при неполной установке; dev может показать фактическую ошибку. После изменения Skills нужен restart dev или rebuild: браузерный bundle содержит снимок проверки, а не live filesystem monitor.

Статусы: installed, available, verification_required, installation_failed. Источники проверяются строгим GitHub URL и безопасным относительным путём; версии — full 40-character commits. Старое ограничение «ровно 8 Skills» заменено текущим запросом Director; ровно 8 работников и 8 профилей остаётся обязательным.

TaskSystem, EventBus, MockTeamWorkflow, исходная сцена и анимации не менялись. Codex CLI 0.144.5 проверен как host для формата Skills; runtime в приложение не подключён и реальная работа агентов не запускалась. Полный аудитный каталог: docs/COMMUNITY_SKILLS_CATALOG.md.

Ниже — история предыдущих этапов; актуальные назначения описаны выше и в каталоге.

## Этап 3 — конфигурация ролей

- `src/agents/registry.json` содержит нормализованные определения восьми Skills, восьми профилей и восьми employee-связок. `registry.ts` проверяет ссылки, уникальность, владельцев профилей, количество и существующие роли из config.ts до создания состояния.
- `Agent` дополнен полями skillId, skillName, skillDescription, customAgentId, responsibility. `createOffice()` заполняет их из реестра. TaskSystem/state/helpers сохраняют метаданные при обновлениях без новых команд и без изменения workflow.
- `src/ui/AgentSkills.tsx` показывает метаданные в текущей карточке сотрудника, не читая файловую систему и не дублируя mapping.
- `.agents/skills/<id>/SKILL.md` — инструкции с YAML metadata; `.codex/agents/<id>.toml` — проектный профиль только с name, description, developer_instructions. Связь со Skill явная в тексте; доступные проектные Skills не эксклюзивны.
- `scripts/validate_agents.py` проверяет файлы, YAML SafeLoader и TOML через tomllib, наличие восьми артефактов каждого типа и ссылки. PyYAML — только локальный инструмент проверки в игнорируемом work/, не runtime-зависимость браузера.
- Проверки включают отображение реального компонента Employee Details, отсутствующие/дублирующиеся определения, ошибочные назначения, синтаксис и сохранение metadata через workflow/reset.

Подробности: docs/TEAM_STRUCTURE.md, docs/AGENT_SKILLS.md, docs/AGENT_PROFILES.md. Этап 3 не запускает профили и не добавляет API или runtime Codex. Ни конструктор модели, ни UI не запускают процессы по customAgentId.

## Этап 2 — действующая модель

`Agent State (state/agents.ts)` → `Task System (tasks/TaskSystem.ts)` → `Event System (events/EventBus.ts)` → `CodexAdapter` → `UI`.

- `domain.ts`: Agent с lastActivity/startedAt/completedAt и lowercase-статусами; Task с отдельными статусами, priority/progress/createdAt; команды и события.
- `state/office.ts`: начальный офис (8 idle, без задач), проекты и производные показатели. Случайное переключение статусов удалено.
- `state/agents.ts`: согласование состояния сотрудника с задачей и освобождение при передаче. Пиксельные цвета и DisplayStatus добавляет только `ui/presentation.ts`.
- `tasks/TaskSystem.ts`: единственная точка изменения задач и работников; допустимые переходы, одна незакрытая задача на исполнителя, проверка существования сотрудника, защита закрытых задач и монотонный прогресс до 99%. 100% устанавливается только при completed.
- Команда выполняется на копии состояния: при отказе ничего не меняется и события не публикуются. После успешного изменения весь набор событий записывается в Activity и доставляется подписчикам. Геттеры и события возвращают копии.
- `events/EventBus.ts`: подписка/отписка; ошибка одного обработчика не блокирует остальных. Activity сохраняет последние 80 событий, интерфейс показывает последние 20 подходящих фильтру.
- События: task_created, task_assigned, task_started, task_progress, task_review, task_testing, task_completed, task_failed, agent_status_changed. Последнее генерируется при смене статуса или текущей задачи.
- Pending-задача с исполнителем резервирует его и даёт waiting. Запуск → working; review → reviewing; testing автоматически передаёт QA; completed → completed/100%; failed → error с сохранением достигнутого прогресса.
- При передаче предыдущий исполнитель становится idle и освобождает currentTask. Закрытая задача может оставаться в currentTask последнего исполнителя как результат; она не блокирует новое назначение. startedAt задачи — первый запуск; startedAt сотрудника — начало текущего участия. completedAt — время закрытия, включая failed.
- `integration/MockTeamWorkflow.ts`: последовательность Lead создаёт → Frontend получает/запускает/делает 35% и 75% → QA тестирует → Technical Reviewer независимо проверяет → Lead получает → completed. Пауза сохраняет шаг, сброс отменяет процесс и очищает данные. Повторный запуск создаёт новую задачу.
- `integration/CodexAdapter.ts`: внутренний контракт getAgents/getTasks/getEvents/getSnapshot/subscribeToEvents/dispatch. MockCodexAdapter реализует его и управляет таймером workflow. Все ручные изменения заблокированы во время workflow (включая паузу), чтобы не нарушать его последовательность.
- `ui/useOffice.ts`: подписка и отправка команд; бизнес-правила не находятся в React. `TaskPanel.tsx` — ручное создание, назначение, переходы и прогресс; формы могут выдавать ошибки правил без частичных изменений.

Состояние хранится в памяти. Перезагрузка и сброс очищают задачи. Реальный Codex на этапе 2 не подключается; исследование ниже относится к этапу 1 и требует актуализации перед будущей интеграцией.

## Исходная архитектура этапа 1 (история)

Office UI (`src/ui`) → Agent State (`src/state`) ← CodexAdapter (`src/integration`).

- Agent System: фиксированный readonly-каталог восьми ролей в `src/config.ts`.
- Domain: Agent, Task, Project, ActivityEvent и AgentStatus в `src/domain.ts`.
- Agent State: чистая функция обновления, независимая от React, и производные показатели.
- Task System: задачи по ID, назначение, startedAt/completedAt; состояние согласуется с агентом.
- Project System: проекты по ID, активный проект в конфигурации; сейчас один демонстрационный.
- Activity Log: последние 80 событий, источник mock.
- Codex Integration: интерфейс подписки и жизненного цикла; MockCodexAdapter генерирует события. UI не знает транспорт.
- Configuration: имена, цвета персонажей, роли, интервал симуляции.

## Исследование Codex — 12 ноября 2026

Официальные механизмы:
1. [Codex TypeScript SDK](https://learn.chatgpt.com/docs/codex-sdk): серверная библиотека, Node.js 18+, запуск/возобновление потоков.
2. [codex exec --json](https://learn.chatgpt.com/docs/non-interactive-mode): JSONL-события thread/turn/item/error для автоматизации.
3. [app-server](https://learn.chatgpt.com/docs/app-server): JSON-RPC с событиями и подтверждениями; stdio, экспериментальный WebSocket, локальный Unix socket.

Обычная браузерная страница не запускает CLI и не читает его stdio. В будущем нужен локальный доверенный мост к SDK или app-server. События потока нужно явно сопоставлять с одним из восьми работников: роли офиса не являются встроенными ролями Codex. Это внутренний контракт AI Office, а не выдуманный Codex API.

На этапе 1 нет реальных запросов, чтения сессий Codex, ключей или доступа к репозиториям. Подключение реального источника отложено до проверки офиса.
