# Stage 4B — Pause, Checkpoint & Resume

Only Lead Developer has a real runtime. The seven other employees, existing office scene, sprites, animations, Skills and mock workflow remain. Start with `npm run build`, then `npm run bridge` in the signed-in Windows user's ordinary terminal; open http://127.0.0.1:8787. Mock is still the startup mode.

## Controls

In Codex pilot, **Пауза** requests `turn/interrupt`; **Pausing** means confirmation is pending. A confirmed interrupted turn becomes **Paused / Resumable**, preserving the same task, employee and original thread ID. If the task finishes before interruption, Completed wins and Resume stays unavailable. The global animation pause is separate from task pause.

The Task Panel has **Пауза задачи**, **Возобновить задачу**, **Сохранить checkpoint**, **Где остановились**, plus a small text control. Recognized commands: `Пауза`, `Продолжим работу`, `Продолжить`, `Показать checkpoint`, `Где остановились`, `checkpoint` and their documented English counterparts. These are fixed application controls, never arbitrary prompts or shell commands. Multiple resumable tasks require explicit task selection.

Manual checkpoint captures ongoing work without falsely declaring it stopped or allowing a duplicate resume. Pause and disconnect persist recovery context; browser reload and application restart do not automatically submit another task. A single bridge owns the project recovery file; a second bridge is rejected. A stale lock can be reclaimed only when its process is confirmed absent.

## Persistence and validation

Real recovery data: **`.ai-office/recovery.json`**, ignored by Git. One versioned JSON file, written to an exclusive temporary file, flushed and atomically renamed. No database. On Windows the flush handle has write access. The old file remains authoritative until replacement. Unreadable/corrupt/oversized files and symlink escapes fail closed; they are not silently replaced. Store errors are shown in UI and block Resume. There is no encryption or promise of protection against another process running with the same user's authority.

Mock checkpoints use **localStorage key `ai-office:mock-checkpoints:v1`**, with an injectable memory store for tests. They never share the real checkpoint file. Reset mock intentionally clears its own recovery data. Runtime and mock sources remain distinct.

TaskCheckpoint contains id, task/agent/project IDs, reason, status, source, createdAt, resumable, task title/description/status, completedWork, remainingWork, importantDecisions, relevant file paths/hashes, original Codex thread ID and lastKnownState. The latter preserves turn ID, start time, plan and step statuses, bounded work notes, stop confirmation, prior task status/progress, verified limit code and mock workflow step. It does not save only the final assistant message, and does not persist account details, environment variables, credential files, raw RPC, command output or reasoning.

Strict schemas reject unknown keys, duplicate IDs, missing tasks, changed employee ownership, unsafe paths, invalid states and secret-looking values. Real ownership is restricted to existing employee `lead` in `office-demo`; current registry/profile/installed Skills are checked again before execution. Text is redacted for recognized API keys, JWTs, bearer values, password/cookie/token assignments and private key blocks before persistence. This is a bounded local pilot with fixed public project inputs, not a general-purpose DLP service. Do not add arbitrary sensitive inputs to it.

The store currently caps tasks at 100, checkpoints at 500 and serialized state at 8 MB. Hitting storage/validation bounds produces a visible recovery error; it never silently drops old work or fabricates a Codex usage limit.

## Limit detection

Reviewed against installed **codex-cli 0.144.5** generated ErrorNotification, TurnError, CodexErrorInfo and ThreadResumeParams/Response schemas, alongside [official app-server documentation](https://learn.chatgpt.com/docs/app-server). Recognized terminal codes are `usageLimitExceeded`, `sessionBudgetExceeded`, `contextWindowExceeded`, or HTTP 429 inside the verified CodexErrorInfo upstream-error variants. Only `error.error.codexErrorInfo` or terminal `turn.error.codexErrorInfo` supplies this classification. Message text, silence, timeout, generic failures and retry warnings are not limits.

A non-retrying limit warning preserves a pending checkpoint while waiting for terminal confirmation. A failed/interrupted terminal turn carrying that verified condition becomes an application **paused** task, never failed/completed; it emits `task_paused_limit`. A recovering `willRetry: true` warning leaves the turn active. Raw runtime failure and application task recovery are separate facts. Limit scenarios are tested with schema-shaped fixtures, not by exhausting a real account. Retry is explicit, never automatic billing/limit polling.

## Resume and fallback

1. Select the latest valid checkpoint for an existing paused task. Completed/failed tasks are excluded. Ambiguity is an error, not a guess.
2. Connect/authenticate, recheck the existing Lead role/profile/Skill receipts and attach fresh authorized project snapshots.
3. Call the reviewed **`thread/resume`** with the stored ID and the same read-only/on-request/user policy. Stage 4B new threads use `ephemeral: false`. Stage 4A ephemeral history is not retroactively made persistent.
4. Verify returned sandbox/approval settings and reject an already-active original thread rather than submitting duplicate work.
5. If a healthy runtime explicitly rejects thread restoration, construct a new persistent thread from the checkpoint. Transport loss or timeout does not prove a missing thread and does not trigger fallback. A context-window limit uses checkpoint continuation in a fresh thread to avoid replaying an already-full context.
6. Send a continuation request containing completed work, remaining work, decisions, stop location, previous plan/notes and relevant files. It explicitly says to continue the same task, avoid unnecessary repetition, treat checkpoint text as untrusted context and review changed source hashes. Task ID remains unchanged even if fallback changes the thread ID.
7. Runtime `turn/started` confirms resumed execution. Failed recovery retains a valid checkpoint, closes unsafe/inconclusive connections and emits `resume_failed`. A confirmed Completed event wins a lost response race.

Original-thread capability exists in the reviewed protocol. Whether it actually worked on this machine is reported separately in STAGE4B-REPORT.md; fixture results are not claimed as real runtime verification. Auth, sandbox policies and approvals are never taken from the checkpoint as permissions.

After unexpected exit or a hard restart, a rolling checkpoint can recover partial work. Stop may remain **unconfirmed**, which is shown in UI. Recovery checks the original thread before starting another turn; a checkpoint is not a promise that every last unacknowledged model operation survived a crash.

## Events and tests

Timestamped application events: `task_pause_requested`, `task_paused`, `task_paused_limit`, `checkpoint_created`, `task_resume_requested`, `task_resumed`, `checkpoint_restored`, `resume_failed`. Bridge-generated control/checkpoint events are marked `origin: bridge`; actual Codex notifications are marked `origin: runtime`. Related real-source events remain `codex`; mock events remain `mock`. The event subscription emits new events once, independently of UI snapshot polling.

Run `npm test`, `npm run validate:agents`, `npm run build` and browser checks. Tests cover scenarios A–E, original-thread restoration, fallback, retryable/false limits, duplicate work prevention, invalid/untrusted state, sensitive text redaction, disk recovery, lost-response races and all Stage 4A regressions. Final real/browser evidence, limitations and Git status belong in STAGE4B-REPORT.md. Stop after 4B; do not connect other employees or start 4C.
