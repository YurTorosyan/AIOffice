# Stage 6 — Full Team Workflow

Развитие существующего Orchestrator, не новая система и не девятый работник. Восемь ID/ролей, Skills, офис, анимации, Real/Mock и Stage 4B/5 сохранены. Старые workflows version 1 читаются без миграции; Stage 6 добавляет необязательный `team`.

## Запуск и полномочия

`npm run build`, `npm run bridge`; строка запуска содержит **Stage 6 team workflow**. В прежнем блоке Team workflow включить **Full Team Workflow · Stage 6**, выбрать предел исправлений 0–3 и задать цель. Mock остаётся симуляцией с ручным переходом следующего шага. В Codex подключить сотрудников; start workflow запускает настоящий Lead.

Director явно выбрал подтверждать конкретные изменения. Codex по-прежнему read-only: создаёт структурированные предложения кода, не получает shell/write/network/grants и не делегирует. Применение — отдельное действие bridge после конкретного согласия пользователя. В панели показываются ответственный работник, причина, точный список файлов и тексты до/после с исходными SHA-256. Согласие на один diff не разрешает следующие изменения или запуск тестов.

Изменения ограничены точными source/test путями внутри текущего проекта. Секреты, traversal, symlinks, зависимости/конфиги, agent profiles, Skills и управляющий код orchestration/integration/agents защищены. App/Office и основное оформление офиса недоступны для proposals. Для изменения этих границ требуется отдельное решение владельца, не просьба модели. Нет произвольного выбора repository, command или cwd. Существующие файлы заменяются только при совпадении исходного hash; никакого overwrite чужих изменений. Применение не делает commit и не публикует код самостоятельно.

## Динамический граф и ответственность

Lead возвращает JSON specialist plan с acceptance criteria и точными scope paths. Это данные: проверяются роли/Skills, уникальность, DAG, размер, путь и конфликтующие параллельные write scopes. Только необходимые Design/Frontend/Backend участвуют в исходном плане; фиксирован не сценарий проекта, а политика обязательных проверок:

- QA после всех implementation tasks.
- Security при authentication/authorization/permissions/secrets/API/file access/commands/integrations/input/sensitive data. Риск определяется root request и scope плюс явная роль, не тем, что сотрудник свободен.
- SEO для public pages/metadata/schema/indexing/canonical/sitemap/robots/discoverability. Не добавляется к приватному интерфейсу лишь для участия всех восьмерых.
- QA/Security/SEO выполняются независимо, когда им доступны все implementation results и свободные слоты.
- Независимый Technical Reviewer ждёт обязательные PASS-gates. Его APPROVED не выводится из чужого «готово».
- Финальный Lead получает verdicts и evidence, принимает интеграционное решение. COMPLETED требует прохождения всех текущих gates, включая Lead.

Пример authenticated settings вызывает Security, не SEO. Отсутствующий реальный auth provider — BLOCKED, а не выдуманная production authentication. Неподдерживаемый scope не расширяется автоматически.

## Модель и handoffs

Workflow хранит прежний DAG/lifecycle и TeamState: PLANNING, READY, RUNNING, WAITING_FOR_DEPENDENCY, WAITING_FOR_APPROVAL, PAUSED, QA_REQUIRED, REVIEW_REQUIRED, CHANGES_REQUIRED, COMPLETED, FAILED, CANCELLED. Состояние выводится из проверяемых задач/approvals/verdicts, а не из таймера. TeamSpec задаёт kind, acceptance, scope, corrective round, разрешённые основания remediation и реальные test receipts.

Handoff имеет устойчивый ID и содержит source/target employee, workflow/task/source-task IDs, objective, completedWork, decisions, changedFiles, code/API information, tests, warnings, unresolved issues и nextAction. Дублирующее уведомление не создаёт второй handoff. Сохраняется полная структурированная запись; в prompt поступает ограниченный, атрибутированный контекст прямых зависимостей, не история чата. Изменённые файлы дополнительно прикладываются свежими разрешёнными снимками с hash. После restart/resume реальные сотрудники получают тот же scoped context.

Структурированный ответ закрепляется стандартным `turn/start.outputSchema`, проверенным в локальной схеме CLI 0.144.5 и [официальной документации App Server](https://learn.chatgpt.com/docs/app-server). Схема передаётся и на checkpoint resume. Переоценка сохранённого отклонённого completed результата не запускает новый turn; описания проверок модели не становятся runner evidence. Handoff содержит явный gateVerdict и квитанции согласованных действий из своей dependency lineage, поэтому финальный Lead получает сведения об уже применённых файлах и выданном согласии.

## QA и evidence

QA не может самостоятельно объявить тест выполненным. Перед его запуском появляется отдельный запрос на точный `node --experimental-strip-types --test ...` для согласованных `.test.ts/.test.mjs/.test.js` файлов. Bridge использует абсолютный Node executable, фиксированные argv, `shell:false`, текущий repository cwd, минимальное окружение без credentials и timeout 30 секунд. Команды из model output не исполняются. Node test-код — исполняемый код: пользователь должен просмотреть его перед согласием. Это **не OS sandbox**; не следует подтверждать недоверенный тест-код без проверки.

Receipts содержат фактические exit code, PASS/FAIL/BLOCKED, ограниченный редактированный stdout/stderr и revision hash всего scope. Receipt сохраняется отдельно и повторное подтверждение завершённого action не повторяет запуск. Изменение файла после проверки делает evidence stale и блокирует следующий gate. Модель получает результат и формулирует QA finding/reproduction/severity, но не может подменить evidence или возвратить собственный массив «успешных тестов». PASS без настоящих passing receipts превращается в BLOCKED; фактический failed test не превращается в PASS.

Для UI/browser acceptance Node PASS недостаточен: если scope содержит TSX/CSS или явно нужен браузер, добавляется BLOCKED browser-check. Автоматического browser executor в мосте нет. Требуется отдельная реальная браузерная проверка/подключение исполнителя; модель не может заявить, что запускала браузер. Браузер самого AI Office проверяется при реализации этапа отдельно. Это явная граница текущей интеграции, а не фиктивное выполнение browser QA.

## Feedback loops и blockers

Outcome содержит verdict, completed work, code information, реальные tests, findings (severity/responsible task/reproduction/files), code proposals и next action. QA: PASS/FAIL/BLOCKED. Review: APPROVED/CHANGES_REQUIRED/BLOCKED. Security: PASS/FAIL/BLOCKED; critical/high findings блокируют прохождение, даже если текст модели говорит PASS.

При FAIL/CHANGES_REQUIRED с корректно указанным ответственным implementation task создаётся следующий bounded round: corrective task с прежним scope → QA и нужные Security/SEO → независимый Review → Lead. Не начатые старые gates становятся cancelled, уже завершённые результаты не переписываются. Обязательные проверки выполняются заново после изменённой реализации; прежние PASS не используются для другой ревизии.

Critical/BLOCKED finding создаёт коррекционный путь, но workflow приостанавливается до явного продолжения Director. Неизвестный ответственный, отсутствующая evidence или исчерпанный maxCycles требуют вмешательства; нет угадывания другой роли или бесконечных циклов. Один новый corrective round не повторяет подтверждённую исходную implementation task. Лимит remediation отделён от прежнего лимита recovery attempts.

## Approval, checkpoints, concurrency

Approval request принадлежит конкретным task/employee/action. Повторный approve уже закрытого запроса отклоняется. Reject оставляет понятную причину и приостанавливает workflow; cancel отклоняет все pending effects. Модель не может одобрить сама себя. Runtime permission requests остаются прежними: дополнительных Codex прав не выдаётся.

Прежний Orchestrator сериализует transitions; TeamRuntime дополнительно резервирует максимум 2 execution slots, `AI_OFFICE_MAX_ACTIVE=1` сохраняется. Независимые write proposals разрешены параллельно только для непересекающихся scope; сами file effects сериализованы и проверяются по hash. Одобренные эффекты имеют отдельные durable journals `.ai-office/team-actions/<approval-id>.json`. Частично применённый согласованный diff можно сверить и завершить с тем же ID, без повторного overwrite; изменённый payload не использует прежнее согласие.

Workflow/checkpoint storage сохраняет задачи, handoffs, approvals, rounds и позицию. После перезапуска — PAUSED и явное Resume, никакого autoplay. Model turns восстанавливаются прежним Stage 4B с теми же execution IDs; completed tasks не повторяются. У операции применения файлов/Node test своя граница: текущая подтверждённая команда заканчивается или достигает timeout перед следующей serialized pause. Неизвестный исход прерванного теста не воспроизводится автоматически; journal блокирует его до вмешательства Director. Уже применённые пользователем изменения не откатываются при Cancel и остаются видны в Git.

## Финал и журнал

TeamFinal содержит исходную цель, участвовавших работников, законченные subtasks, фактически применённые файлы, test receipts, актуальные security findings, QA/review verdicts, оставшиеся предупреждения, timestamps и final status. COMPLETED — это прохождение необходимых gates текущей ревизии, а не просто окончание model turn.

Team Activity получает planning_started, employee_selected, task_assigned/started/completed, handoff_created, dependency_satisfied, qa_started/failed, security_review_started/blocker, review_started/rejected, remediation_created, approvals, resumed/paused/completed. Все события привязаны к workflow/task; проценты из времени не выдумываются.

## Проверки и ограничения

`team-workflow.test.ts`: basic/parallel, QA remediation, review rejection, security blocking, bounded rounds, approvals, restart/handoffs, Stage 4B limits, cancellation, duplicate protection, role relevance, scope conflict, truthful evidence. `team-actions.test.mjs`: реальные записи в отдельной временной тестовой директории, stale hashes, idempotent receipts, реальные Node PASS/FAIL, redaction, source preview. Старые tests Stage 4B/5 сохраняются. Test directories находятся в игнорируемом work; данные runtime не публикуются как credentials.

Границы: фиксирован один текущий проект; максимум 8 scoped files и 4 proposals за действие; production auth/browser executor не придумываются; нет полного filesystem/network sandbox у подтверждённых Node tests; локальному Windows-пользователю и его процессам по-прежнему доверяют. Stage 7 не реализован.
