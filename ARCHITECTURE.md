# Архитектура

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
