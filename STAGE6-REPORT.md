# Stage 6 — Full Team Workflow

**Реализован и проверен, включая согласованное создание двух файлов, реальные Node tests, QA, независимый Review и итог Lead. Stage 7 не входит в этот commit.**

1. **Архитектура.** Прежний Orchestrator расширен необязательным TeamState, gate policy, handoffs, approvals и ограниченными remediation rounds. Stage 5 не заменён; его сохранённая история version 1 совместима. Подробности: [docs/TEAM_WORKFLOW.md](docs/TEAM_WORKFLOW.md).
2. **Совместная работа.** Lead создаёт динамический scoped specialist plan с acceptance criteria; система добавляет QA, Security/SEO при необходимости, независимый Review и финальный Lead. Не требуется участие всех восьмерых. Состав/IDs/Skills/графика сохранены.
3. **Handoffs.** Устойчивые IDs, source/target employees и tasks, objective, completed work, decisions, actual changed files, code/API information, test receipts, warnings, unresolved issues, nextAction. Контекст прямых зависимостей ограничен; история диалога не копируется.
4. **Зависимости.** DAG/IDs/roles/Skills/scope проверяются. Завершённый model turn с FAIL/BLOCKED не разблокирует dependents. Финал требует прохождения актуальных gates, а не только наличия ответов.
5. **Параллельность.** До двух запусков через прежнюю reservation; последовательный режим сохраняется. Design и Backend могут работать одновременно; пересекающиеся независимые write scopes отклоняются.
6. **QA loop.** Реальные фиксированные Node tests выполняются bridge только после отдельного согласия. Модель QA получает exit code/output/revision hash, не может выдумать evidence. FAIL → ответственный implementation task → исправление → повторные проверки; maxCycles 0–3 задаётся пользователем.
7. **Security.** Риск-триггеры включают auth/permissions/secrets/API/files/commands/integrations/input/sensitive data. Critical/high findings блокируют gate независимо от слова PASS. Для корректно атрибутированного finding создаются corrective tasks; critical/BLOCKED требует явного продолжения Director.
8. **Review.** APPROVED / CHANGES_REQUIRED / BLOCKED. Независимый Reviewer получает свежие scoped snapshots и проверенные результаты gates; возврат на доработку не переписывает старые verdicts. Lead формирует итог только после актуальных проверок.
9. **Approvals.** Пользователь выбрал подтверждать конкретные изменения. Панель показывает тексты до/после, файлы, исполнителя, причину и точную тестовую команду. Отдельный согласованный diff и test action имеют durable receipts; повторное согласие не повторяет завершённый эффект. Нет автоматической выдачи Codex shell/write/network/grants.
10. **Pause / Checkpoint / Resume.** Прежний Stage 4B и IDs model sessions сохраняются. Handoffs/approvals/round/dependencies/position входят в recovery. После restart — PAUSED, без autoplay и повторного исполнения completed tasks. Одобренная файловая/Node операция имеет отдельную journal boundary; неизвестный исход теста не повторяется автоматически.
11. **Failure recovery.** Старые limit/disconnect/recoverable/permanent states сохранены; QA failure, security blocker и reviewer rejection представлены отдельными verdicts/findings/events. Stale diff или stale test revision блокируют выполнение. Смена source во время model gate проверяется ещё раз при приёме результата. Cancel безопасно закрывает pending approvals; уже согласованные изменения не откатываются автоматически.
12. **Тесты.** Финальный полный набор: **158 Node + 6 Python — PASS**, включая Stage 4B/5 и четыре согласованных pilot-теста. После последней правки происхождения approvals/handoffs: **19 Team Workflow tests — PASS**, без повторных вызовов моделей. Также проверены outputSchema на start/resume, реальные file effects, Node PASS/FAIL и stale evidence. Логи: игнорируемые `work/stage6-tests.log`, `stage6-receipt-handoff-tests.log`.
13. **Production build.** PASS: 44 модуля, JS 347.74 kB / gzip 102.03 kB, CSS 26.61 kB / gzip 6.71 kB. `git diff --check` — PASS. `public/art` без изменений.
14. **Browser.** Mock прошёл полный цикл с отдельными approvals. На 390×844 document width 375, восемь интерактивных сотрудников, ошибок console 0; переполнение select исправлено. [Mock](docs/stage6-mock-team.png), [mobile](docs/stage6-mobile.png). Реальный workflow `fa179d5b-c5ab-45c7-8cfc-b6f9a21cd180` — COMPLETED: 5 model tasks, по одной попытке, 4 роли (Lead/Backend/QA/Reviewer). Director одобрил два новых файла и конкретный Node command; 4/4 tests PASS, exit code 0, source=runner. QA PASS, Review APPROVED, Lead PASS. В браузере подтверждены оба approvals, 4 handoffs и прежний Stage 5 workflow. [Реальный снимок](docs/stage6-real-team.png), [метаданные](docs/STAGE6_EVIDENCE.json), [одобренный diff](docs/STAGE6_PILOT_PROPOSAL.md).
15. **Git.** База Stage 5: `363a160d5ac244278b8ae47a211b52350ae2a905`. Финальный commit: `feat: implement team workflow`; точный хеш приводится после его создания в сообщении пользователю.

## Изменённые файлы

- Новые: `src/orchestration/team-workflow.ts`, `server/team-actions.mjs`, `server/team-output.mjs`, `tests/team-workflow.test.ts`, `tests/team-actions.test.mjs`, `tests/team-output.test.mjs`; согласованные `src/team-pilot/clamp.ts` и `tests/team-pilot-clamp.test.ts`.
- Расширены: `src/orchestration/model.ts`, `Orchestrator.ts`, `MockExecutionPort.ts`, `WorkflowClient.ts`; `server/team.mjs`, `orchestration.mjs`, `http.mjs`; `src/ui/WorkflowPanel.tsx`, `style.css`.
- Документация: AGENTS/PROJECT/ARCHITECTURE/README, TEAM_STRUCTURE, TEAM_WORKFLOW, этот отчёт и browser captures.
- `.ai-office` и `work` остаются игнорируемыми; нет изменений vendored Skills, lockfile, состава и изображений офиса.

## Наблюдения живого прогона

1. Исключения «не менять API/auth», «SEO не нужен» первоначально ошибочно включили лишние gates. Уточнён анализ положительной цели и фактического scope; отменяются только не начатые optional gates. Реальные Security/SEO задания этого pilot не запускались.
2. Backend перечислил предполагаемые файлы как filesChanged и описал статические проверки в tests. Ответ сначала безопасно отклонён, без записи/команд. Добавлен стабильный turn/start.outputSchema, подтверждённый официальной документацией и локальной схемой CLI 0.144.5. Сохранённое предложение переоценено с тем же execution ID: paths остаются proposals, описания проверок не считаются runner evidence. Lead/Backend повторно не запускались.
3. После согласия Director выполнены два точных действия bridge с durable receipts. Исторические результаты не переписываются.
4. Lead дал PASS, но в исторической заметке ошибочно запросил уже полученное согласие. Оба approvals, фактические file hashes, test exit code и независимый APPROVED подтверждены отдельно. В handoffs добавлены gateVerdict и транзитивные approval/file receipts; regression-тест доказывает передачу этих фактов финальному Lead. Историческая ошибка модели сохранена как заметка, не как отсутствие согласия; дополнительных model turns не было.
5. Самостоятельный restart: первая совмещённая команда ранее отклонена auto-review с «blocked by policy». После явного запроса пользователя сотрудники штатно отключены через API, но Windows отклонила остановку bridge node с Access is denied. Сервис не остановлен и данные не удалены. Последняя правка обогащения handoff загрузится при следующем штатном перезапуске владельцем процесса; повторять завершённый workflow не нужно.

## Явные границы

- Реальный browser executor в bridge не настроен. Для TSX/CSS/browser acceptance Node PASS недостаточен: QA получает BLOCKED browser-check, а не выдуманное успешное тестирование. Проверка интерфейса самого офиса выполнена отдельно через браузер.
- Подтверждённые Node tests выполняются локально с ограниченными argv и минимальным окружением, но **не внутри OS sandbox**. Их код надо просмотреть до согласия. Codex новых прав не получает.
- Файловый scope ограничен src/tests и защищает управляющий код и офис. Нет произвольного выбора repository, unrestricted command endpoint или вымышленного auth provider.
- Неизвестный результат прерванной одобренной host-операции может требовать вмешательства Director; система не выдаёт его за completed и не запускает скрытый повтор.
