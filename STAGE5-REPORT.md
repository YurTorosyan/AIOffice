# Stage 5 — Agent Orchestrator

**Статус: реализован и проверен. Stage 6 не начат. Реальные задания остаются read-only; завершение workflow не означает независимого одобрения кода.**

1. Архитектура: отдельный Orchestrator, ExecutionPort, реальные/Mock реализации, UI-клиент. Реальный порт использует существующий TeamRuntime и прежний RPC. Подробности: [docs/ORCHESTRATOR.md](docs/ORCHESTRATOR.md).
2. Модель: workflow/root task и DAG subtasks; роли/Skills, зависимости, lifecycle, priority, context, result/error, timestamps, execution/attempt/checkpoint IDs. Никаких вымышленных процентов.
3. Выбор: фиксированный каталог восьми компетенций; проверка registry, фактически обнаруженных Skills, connection/availability/recovery. Другой свободный сотрудник не получает чужую роль.
4. Зависимости: реальный JSON-план Lead валидируется; unknown IDs, циклы, дубликаты, лишние поля/права отклоняются. Независимые ветви получают свободные слоты.
5. Контекст: только прямые результаты с attribution, bounded summary/decisions/warnings/unresolved; filesChanged пуст в read-only. История разговоров не копируется. Секреты известных форм редактируются/отклоняются.
6. Ошибки: pause, usage limit, disconnect, recoverable/permanent failure и approval различаются. Retry только явный, максимум 3 исполнения; при существующем checkpoint продолжается прежнее задание. Автоматического переназначения другой роли нет.
7. Stage 4B: прежние employee checkpoints сохранены; отдельное atomic workflows.json под прежним bridge lock. После restart — пауза и сверка execution IDs, без повтора завершённого. Ошибка записи recovery до submission блокирует модельный запуск.
8. Права: workflow приостанавливается при approval; ожидание Director, без автоматического ответа. Прежний read-only scope разрешает отклонение дополнительных прав, не выдачу новых grants.
9. Параллельность: максимум 2 (либо 1 через прежнюю настройку), включая индивидуальные задания; сериализованный scheduler плюс прежняя атомарная reservation. Один открытый workflow, до 16 рабочих задач.
10. Тесты: полный suite **127 Node + 6 Python — PASS**. После уточнения starting/running выполнены **30 targeted orchestration tests — PASS**. После обнаруженной в живом прогоне потери второго наблюдения выполнены **27 orchestration tests — PASS**, включая новую проверку сохранения обоих наблюдений. Повторные задания Codex для этой локальной функции не запускались. Включены индивидуальные подключения восьмерых и восстановление Stage 4B в существующих team/checkpoint тестах. `validate:agents`: 8 профилей, 12 pinned Skills — PASS.
11. Production build: **PASS**, 43 модуля, JS 320.41 kB / gzip 94.00 kB, CSS 26.21 kB / gzip 6.63 kB. `git diff --check` — PASS.
12. Browser: mock workflow создан из UI, план → backend, пауза всего workflow, reload, сохранённое состояние, явное resume с прежним execution ID, QA → Lead → completed. Историческая paused Frontend-задача сохранена. Новая сборка открыта после reload: completed граф/зависимости/IDs сохранены. Экран 390×844: document width 375, восемь интерактивных работников, горизонтального переполнения нет; console errors/warnings — 0. Снимки: [desktop](docs/stage5-mock-workflow.png), [mobile](docs/stage5-mobile.png). Реальный workflow `a905a0d0-e74f-4a51-8039-f3c5f0754719` завершился: Lead спланировал две рабочие задачи → Backend → Technical Reviewer. Все три исполнения завершены, по одной попытке, порядок подтверждён timestamps; передан прямой upstream результат; 8 сотрудников connected, 0 active, 32 разрешённых снимка не изменены. Console errors/warnings — 0. [Снимок](docs/stage5-real-workflow.png), [метаданные и хеши](docs/STAGE5_EVIDENCE.json). Графические assets: `git diff --quiet -- public/art` = 0.
13. Git: база Stage 4C `3568262d18a6bc8123af4a598b53540c5856964a`. Финальный commit: `feat: add agent orchestrator`; точный хеш приводится в итоговом сообщении после создания commit.

## Изменённые файлы

- Новые: `src/orchestration/model.ts`, `Orchestrator.ts`, `MockExecutionPort.ts`, `WorkflowClient.ts`; `server/orchestration.mjs`; `src/ui/WorkflowPanel.tsx`.
- Интеграция: `server/team.mjs`, `http.mjs`, `checkpoint-pilot.mjs`; `src/integration/MockCodexAdapter.ts`; `src/ui/useOffice.ts`, `App.tsx`, `style.css`; `vite.config.ts`.
- Проверки: `tests/orchestrator.test.ts`, `tests/orchestrator-server.test.mjs`.
- Документация: `AGENTS.md`, `PROJECT.md`, `ARCHITECTURE.md`, `README.md`, `docs/TEAM_STRUCTURE.md`, `docs/ORCHESTRATOR.md`, этот отчёт.

## Живой прогон и исправление handoff

Lead построил валидный граф из двух рабочих задач по конкретному запросу Director. Backend вернул два наблюдения в structured decisions. Reviewer получил только первый усечённый элемент из-за слишком агрессивного ограничения списков и корректно сообщил, что второе наблюдение отсутствует, а собственный снимок не содержит HTTP-обработчик. Это **не положительный verdict** независимого ревью.

Исправлена чистая функция buildContext: короткие списки решений/предупреждений/открытых вопросов сохраняются целиком, ограничение применяется к общему бюджету каждого списка, а усечение отмечается `[…]`. Новая regression-проверка использует два наблюдения по 330 символов. Кроме теста, функция применена к сохранённому реальному результату: исправленный upstream в точности сохраняет оба наблюдения Backend. Исторический результат Reviewer не подменён и не переписан. Новых платных модельных заданий после исправления не запускали.

Пользовательский мост запрошено перезапустить для загрузки этой последней серверной правки. Если он ещё открыт со старым кодом, достаточно обычного `Ctrl+C → npm run bridge` перед следующим workflow. Прежний завершённый workflow сохранён на диске; повторять его не нужно.

Границы/риски: анализ не превращён в запись файлов; approval не расширяет права; неизвестное execution и потерянный результат требуют вмешательства Director. Полный raw dialog не переносится. Хранилища имеют явные лимиты истории. Mock рассчитан на одну управляющую вкладку. Полные ограничения описаны в ORCHESTRATOR.md.
