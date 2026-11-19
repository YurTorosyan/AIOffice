# Stabilization P0–P3

Implementation branch: `stabilization/p0-p3`, based on `9021ff0`. Director authorized isolated implementation after approving contract D1–D8. This document describes the implementation, not deployment to the running bridge. See [acceptance matrix](STABILIZATION_SCENARIOS.md) and [verification report](STABILIZATION_REPORT.md).

## Boundaries

Eight existing employees, IDs, roles, Skills, office assets and animations remain unchanged. No model is given write/shell/network access. Exact diff approval and separate QA approval remain mandatory. No real Codex tasks, live workflow transitions, file applications or tests of ARMGARAGE/Coffee House are part of validation. Test workspaces live under ignored `work/`; browser checks use an ephemeral port and fresh profile.

P0's planned scope was extended for P1–P3 under the subsequent broad authorization. Additional changes include the shared budget/input/quality/diagnostic modules; `useOffice.ts` to publish offline transport state; `team-workflow.ts` approval/recovery integrity; fixed test fixtures; and deterministic test concurrency. No graphics or agent registry changes are included.

## P0: persistence and effects

- `server/durable-json.mjs` publishes flushed, validated JSON with unique exclusive temporary files, compare-and-swap hashes, bounded Windows replacement retries, immutable artifact publication and post-write verification. A publication error has an explicit unknown outcome. Cleanup never removes another writer's temporary file or masks the original result.
- Checkpoint, workflow and permission stores use the same primitive. Corrupt/unsupported data is preserved and execution is blocked. Existing project writer locks remain in force. Workflow transitions roll memory back to the last confirmed book when saving fails; they do not silently retain an unsaved approval as successful.
- Final model messages are archived at receipt time, before scheduler observation or result parsing. Artifacts bind project/workspace, task, execution, employee, thread, turn and SHA-256. Separate turns have separate immutable artifacts. Complete, redacted and truncated output remain distinct. A short checkpoint note is not a fallback for a missing full production result.
- A storage failure retains bounded safe response text in memory for explicit reconciliation; original secrets are not retained in that retry buffer. Recovery preserves the redacted/truncated classification. A process dying before a response could be durably written cannot be claimed as preserving an unconfirmed response.
- `OperationStore` binds immutable approved payloads, permissions and individual before/after file hashes to a stable operation ID. Intent precedes grant consumption and effects. Permission sets are checked together and consumed in one durable update. File contents are flushed before replacement; receipts precede workflow acknowledgement.
- After a crash, inspection classifies each resource as before / after / conflict. Already applied files are observed without rewriting. Remaining effects need a new exact approval. All-after recovery changes metadata only. A completed operation returns its saved receipt. No automatic file rollback or command replay occurs.
- Isolated QA records container ownership before launch. Unknown QA requires inspection; cleanup requires confirmation and exact operation labels, pinned image and physical container ID. A rerun requires a fresh test approval after stop/absence is established. Missing ownership records never prove that a legacy executor stopped. Unconfirmed containers block project switching.
- Lost start acknowledgements remain owned and require reconciliation. The scheduler does not turn a missing acknowledgement into a new start. A restored execution without confirmed stop retains its slot; only its owner can reconcile it. New unrelated work is blocked while its outcome is unknown.

The stores form a recoverable protocol, not a single filesystem-wide transaction. Atomic rename plus file flushing does not guarantee survival of disk/controller failure, Windows filesystem failure or removal of the storage medium. Existing canonical-path and project-identity guards remain necessary.

## P1: feasible plans and complete inputs

`src/orchestration/budgets.ts` is the versioned profile for plan/proposal/prompt/response/input limits. It preserves 8 unique project files, 4 proposal files, 12,000 characters per file, 24,000 per proposal and a 10,000-character prompt. Measurement is JavaScript string length, not tokens. Schema, prompts, admission, response validation and proposal formatting reference this profile.

The system owns QA/Security/SEO/Review/final Lead gates. Lead plans cannot introduce system gate dependencies or parallel overlapping write scopes. Plan admission checks executable test paths, the registered isolation profile, required web setup, role scopes and hashes of previously applied files. An accepted but currently infeasible plan stays saved on pause; no specialist starts. Fixing the prerequisite permits explicit resume without replaying Lead planning.

Every team execution receives `project/task-contract.json`: full objective, description, acceptance criteria, scope, attributed inputs and actual test evidence. Compact prompts explicitly identify themselves as previews. Full transitive handoffs retain execution provenance, findings, warnings, unresolved items and receipts. Inputs v2 also distinguish required applied dependencies from legitimately absent new output files. Missing applied sources block admission. A changed source manifest between preflight and submission blocks the turn.

Dependency semantics are derived from system-owned task kinds: specification, applied code, verification, independent approval or analysis. This is a typed graph contract; it is not a claim to infer every logical contradiction hidden in arbitrary natural-language requirements. Unsupported or overly large work needs an explicit delivery split, not silently reduced criteria or larger permissions.

## P2: quality and freshness

`quality.ts` distinguishes not-run, incomplete, stale, blocked, failed and passed evidence independently of a model's verdict. Trusted executor receipts must match the exact registered commands, source and input revision. Missing web receipts become BLOCKED individually; unit PASS cannot stand in for build and browser checks. Model test descriptions remain unverified notes.

Web verification hashes include the registered profile, pinned image, seccomp, source, lockfile and support configuration. Node verification now includes its fixed executor/image/bootstrap identity and project configuration as well as sources. A gate cannot accept evidence of a previous input revision. Review remains a different employee; final Lead waits for the required current gates.

Explicit verification deferral preserves the original BLOCKED finding and exact applied receipt, moves only genuinely unperformed checks to downstream QA, and never turns them into PASS. Existing bounded corrective rounds, attributed owners, risk gates and high/critical blockers remain in effect. Continuations and evidence rechecks cannot reset their original attempt budget by changing task IDs.

## P3: recovery and observability

The API derives diagnostics for each task's execution, response completeness, effects, quality, dependency requirement, wait reason and shared attempt budget. The existing workflow panel displays these details; it is not an office redesign. Last confirmed save and last received snapshot are separate timestamps.

The client validates snapshots and project ownership. Offline polling retains the last valid state and explicitly displays that it is stale. A lost command response triggers only read-only refresh, never an automatic POST retry. An explicit retry retains request identity; effect idempotency is enforced by the operation journal and serialized engine, not by assuming an HTTP header is a transaction ledger.

Cancellation recovery selects one workflow and leaves it paused. Completed work and rejected approvals stay historical. A preserved unapplied proposal gets a fresh exact approval. Previously started work without a confirmed result is not silently requeued. Another workflow's data remains unchanged; it must be paused before resuming the restored one. Cancellation cannot abandon a started unresolved approval operation.

### Recovery controls

| Condition | Explicit operation | What it does not do |
|---|---|---|
| Storage error | `reconcile_storage` | No model start, file apply or QA rerun |
| Interrupted approval | `prepare_operation_recovery` | No write/delete/command effect during inspection |
| Complete receipt or all-after files | `confirm_operation_recovery` | No repeated file replacement or command |
| Some files still before | New exact approval for remaining files | Does not restore consumed/rejected grants |
| Owned QA container remains | `cleanup_operation`, then inspect | No generic PID/name-based process termination |
| QA confirmed stopped/absent | New test approval | Does not relabel UNKNOWN as PASS |
| Accidental cancellation | `restore_cancelled` | No automatic resume or file rollback |

## Verification environment and additional fixes

`npm test` limits concurrent test files to two to avoid excessive Windows filesystem/process contention. Execution-slot scenarios still separately exercise one and two employee slots. Process-death tests use trusted fixture children and `process.exit`, not just caught exceptions. Neither the host test runner nor the UI fixture grants agents a terminal executor.

The seccomp file is marked `-text` in `.gitattributes` so Windows checkout preserves the exact reviewed hash. Seccomp content, pinned QA images and confinement are unchanged.

AI Office's dev Vite dependency is patched from 8.1.5 to 8.1.6 with lifecycle scripts disabled. This is separate from pinned project QA images. The Windows issue is documented in [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm); the recorded post-update `npm audit` reports zero vulnerabilities. This does not assert that all software is free of security defects.

## Deployment and P4 remain separate

The running bridge and project state were not migrated. Before deployment, stop the bridge gracefully and verify its writer lease; preserve source/untracked files and back up both central project state and project-owned operation/receipt directories. Do not copy live lock ownership to a new process. Verify identity, branch, hashes and supported versions on the backup first.

Old v1 books and unversioned attributed input snapshots remain readable under their original rules. New input v2, response references and operation records must not be written by the old application. Old pending permissions require fresh approval under the current policy. Completed legacy receipts stay historical. An incomplete legacy action without enough owned journal/container evidence fails closed and needs a separate reviewed migration decision; do not manufacture a receipt or blindly replay it.

Do not merge this branch over the running workspace or start a second bridge against its state. The main workspace has user-owned untracked files, including earlier document drafts: compare and preserve them before any future merge. Rollback must retain new receipts and effects, not simply restore an older checkpoint JSON.

P4 requires separate approval: a backed-up rollout, three bounded real Codex control tasks, observed cost/time/recovery measurements and acceptance of remaining limitations. There are no claims of production readiness for arbitrary frameworks, external APIs, unlimited code sizes or unavailable isolation profiles. The currently registered browser profiles remain Coffee House and ARMGARAGE; other browser acceptance contracts require separate registration.
