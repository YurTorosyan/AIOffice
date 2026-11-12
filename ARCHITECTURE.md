# Архитектура

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
