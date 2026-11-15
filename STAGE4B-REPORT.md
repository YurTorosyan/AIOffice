# Stage 4B — Pause, Checkpoint & Resume

## Итог

Добавлены постоянные контрольные точки, подтверждаемая пауза и продолжение существующей задачи. Реальные сценарии A, C, D, E проверены через браузер на **Codex CLI 0.144.5**. Исходный Codex thread действительно восстановился после Pause, после отключения runtime и после перезапуска моста; task ID сохранился, turn ID изменился. Две read-only тестовые задачи Lead завершены, возобновляемых точек не осталось, Codex отключён.

Реальный лимит аккаунта не вызывался. Сценарий B проверен подачей ошибок подтверждённой схемы; fallback нового потока проверен fixtures. Это не выдаётся за наблюдение реального rate limit или отказа thread/resume.

В офисе ровно восемь работников; остальные семь не подключены. Интерьер, пиксельные персонажи и анимации сохранены. Mock остаётся стартовым режимом. Stage 4C не начат.

## Хранение

- Реальные задачи и TaskCheckpoint: **`.ai-office/recovery.json`**, игнорируется Git. Временный файл создаётся эксклюзивно, сбрасывается на диск и атомарно заменяет основной JSON. База данных не добавлена.
- Один мост владеет файлом через локальный lock. Повторный запуск не может перезаписать состояние активного владельца. Удаляется только проверенный stale lock подтверждённо отсутствующего процесса.
- Mock: отдельный **localStorage `ai-office:mock-checkpoints:v1`**; для тестов — memory storage. Реальный JSON не смешивается с mock.
- Checkpoint содержит задачу, исполнителя, проект, причину, статус, completed/remaining work, решения, файлы/hashes, план, ограниченные заметки, turn/thread IDs, start time и подтверждение остановки. Mock дополнительно сохраняет точный шаг workflow, прогресс, приоритет и время создания.
- Схемы проверяют ownership, существование задачи/сотрудника, типы, статусы, уникальность IDs, пути, размеры и отсутствие неожиданных полей. Повреждённые/недоступные данные не заменяются пустым состоянием. Ошибка сохранения показывается и блокирует Resume.
- Auth, credentials, cookies, env и raw RPC/command output не сохраняются. Текст проходит удаление распознаваемых ключей, JWT, bearer values, password/token/cookie assignments и private key blocks. Фиксированный пилот использует только разрешённые проектные снимки, не произвольные чувствительные входные данные.

## Пауза и лимиты

Pause отправляет `turn/interrupt` и остаётся в Pausing до подтверждения interrupted turn. Только после подтверждения checkpoint становится resumable. Completed, пришедший раньше interruption, имеет приоритет и не откатывается в Paused. При потере соединения checkpoint сохраняется с явным **stop not confirmed**, а не с выдуманным подтверждением остановки.

Классификация лимита сверена с generated schemas установленной 0.144.5 и [официальной документацией app-server](https://learn.chatgpt.com/docs/app-server). Используются только `error.error.codexErrorInfo` или terminal `turn.error.codexErrorInfo`: `usageLimitExceeded`, `sessionBudgetExceeded`, `contextWindowExceeded`, HTTP 429 в известных upstream-вариантах. `willRetry: true`, произвольный текст, молчание, timeout и generic 500 не считаются лимитами. При подтверждённом лимите задача сохраняется как paused, событие — `task_paused_limit`; она не становится failed/completed.

## Возобновление

1. Выбирается последняя действительная точка существующей paused задачи. При нескольких кандидатах требуется явный выбор.
2. Заново проверяются текущий Lead, профиль и установленность Skills; применяются актуальные фиксированные снимки проекта.
3. Вызывается **`thread/resume` исходного ID** с read-only/on-request/user policy. Новые потоки 4B постоянные (`ephemeral: false`). Возврат более широких прав или активного исходного потока отклоняется.
4. После подтверждённого отказа здорового runtime восстановить поток используется новый thread и continuation из checkpoint. Timeout/обрыв сами по себе не запускают fallback. Context-window limit использует новый поток с сохранённым контекстом.
5. Агент получает выполненное, оставшееся, решения, место остановки и указание не повторять подтверждённую работу. Изменившиеся hashes явно перечисляются. Идентификатор задачи не меняется.
6. Реальное `turn/started` подтверждает продолжение. Неуспешная попытка сохраняет восстановимую точку; потерянный ответ не может отменить подтверждённый Completed.

Поддержаны Pause, Resume, Show checkpoint, Show where work stopped и команда **«Продолжим работу»** через слой приложения. В Task Panel — причина, checkpoint, выполненное/оставшееся и Resume. Общая пауза анимации остаётся отдельным управлением.

## Проверки и доказательства

| Сценарий | Результат |
|---|---|
| A — ручная пауза | **Реальный PASS**: interrupted подтверждён; 4 выполненных шага и финализация сохранены; task/thread ID те же, turn новый; затем Completed |
| B — лимит | **Fixtures PASS**: подтверждённые enum/429, paused без failed/completed, checkpoint и Resume; ложные лимиты и retry warnings исключены |
| C — disconnect | **Реальный PASS**: active task → disconnected/paused, connection_lost, stop initially unconfirmed → reconnect → исходный thread |
| D — restart | **Реальный PASS**: пользователь перезапустил мост в PowerShell; paused checkpoint сохранился, автозапуска не было; «Продолжим работу» восстановила исходный thread; затем Completed |
| E — Completed | **Реальный и mock PASS**: завершённые задачи не resumable, кнопки Resume выключены |
| Mock recovery | **Browser PASS**: восстановление с 6/8 и 75%, продолжение до 8/8; отдельная задача сохранила ID, 25%, high priority и createdAt после reload/resume |
| Отказы | **Fixtures PASS**: повреждённый JSON, неправильный owner/task, ambiguous resume, недопустимые поля/пути/права, активный thread, timeout, потерянный response, redaction, атомарная запись и lock |

**76 Node + 6 Python — PASS**, включая прежние Stage 4A тесты. `npm run validate:agents` — PASS: 8 профилей, 12/12 pinned Skills, 3 кандидата не установлены. Production build — PASS: 38 modules, JS **281.68 kB**, gzip **84.21 kB**. Новых npm-зависимостей нет. Для Python-проверок использован PyYAML 6.0.3 в игнорируемой `work/validation-deps-stage4b` с process-scoped PYTHONPATH: прежние временные копии были недоступны по правам Windows.

Браузер: реальные Pause/Resume/disconnect/restart/completion, mock reload и естественная команда. Mobile 390×844, document width 375, без переполнения страницы. Console errors/warnings **0/0**. Во время реальных сценариев SHA-256 всех **202 файлов проекта** совпали с исходным состоянием. После них отдельно исправлено сохранение mock priority/createdAt и отображение Resume у завершённой задачи; финальные regression tests и browser check прошли без новых реальных заданий.

Числовые доказательства без сырых thread IDs и приватных checkpoint payload: [STAGE4B_EVIDENCE.json](docs/STAGE4B_EVIDENCE.json). Скриншот: [stage4b-browser.jpg](docs/stage4b-browser.jpg). Полное описание: [CHECKPOINTS.md](docs/CHECKPOINTS.md).

## Изменения и ограничения

Новые слои: `src/checkpoints/model.ts`, `browser.ts`; `server/checkpoint-store.mjs`, `checkpoint-pilot.mjs`; `src/ui/CheckpointPanel.tsx`; checkpoint/mock tests. Расширены общий адаптер, Task/Agent projection, MockCodexAdapter/MockTeamWorkflow, TaskSystem, HTTP allowlist, RuntimePanel/TaskPanel/useOffice, профиль Lead и проектная документация. Основа Stage 4A сохранена: CheckpointPilot расширяет LeadPilot; wire transport и защитные политики прежние. SVG офиса и community Skill receipts не менялись.

Ограничения: app-server экспериментальный и привязан к проверенной CLI 0.144.5. Реальный fallback и реальное исчерпание лимита не наблюдались, только протестированы. После hard crash последние неподтверждённые операции могут быть неизвестны; UI не скрывает этот факт. Checkpoint — контекст, а не полномочия. Сохраняются ограничения read-only пилота, заданий и файлов; общий shell/запись/другие сотрудники не подключены. JSON не зашифрован; процесс с правами владельца остаётся доверенным. Лимиты хранения: 100 tasks, 500 checkpoints, 8 MB; превышение вызывает видимую ошибку, не молчаливое удаление данных.

## Git

Перед изменениями `git status`: чистый main, совпадающий с origin/main. После проверки diff, отсутствия credential patterns и исключения `.ai-office/` создаётся коммит **`feat: add codex task checkpoint and resume`**. Итоговый hash и фактический результат push сообщаются владельцу после создания коммита. Этап 4C автоматически не начинается.
