# Validated planning and bounded recovery

Lead completion and plan acceptance are separate outcomes. A completed model turn with an invalid team plan now pauses for review instead of being treated as an employee execution failure. No model retry, downstream task, file application or test approval is triggered by this recovery path.

## Contract before execution

The planning prompt states the actual implementation budgets: 1–12 specialist tasks, at most eight unique source **and test** files across the graph, four files per implementation proposal, 12,000 characters per patch file and 24,000 per proposal. These are current permission/evidence limits, not a claim that arbitrary production projects fit eight files. Larger work must be deliberately decomposed; recovery never increases permissions or discards requirements to bypass the budget.

The parser rejects malformed JSON, foreign fields, invalid roles/Skills/permissions, missing/cyclic dependencies, parallel ownership conflicts, case-aliased paths, system-owned gates and reserved gate IDs. The complete graph, including broker-created gates, is staged and validated before live tasks are appended.

## Preserved evidence

Optional `Workflow.planRecovery` stores up to three full planning responses (128,000 characters each), execution IDs, timestamps, SHA-256 fingerprints, structured diagnostics and the accepted correction. This archive is independent of the short task-result summary and runtime work-note limits. Existing books remain valid without migration. Invalid or sensitive recovery data fails closed; the original on-disk workflow is not silently replaced.

The UI exposes the original response and fingerprint, validation issues, candidate JSON and test-target mapping. Status is one of `needs_revision`, `proposal_ready`, `revision_ready`, `applied`. Resume is blocked while a rejected plan remains unresolved.

## Recovery operations

- `prepare_plan_repair`: import a previously rejected completed Lead result from the legacy workflow's preserved result, without starting an employee. Legacy summaries already truncated by an older version cannot reconstruct missing bytes; an incomplete response will not produce an accepted correction.
- `apply_plan_repair`: explicitly accept a recomputed, fully validated proposal. Only test-target consolidation is supported: reuse a compatible test file owned by an existing downstream task of the same implementation role. All tasks, dependencies and acceptance criteria remain; descriptions require preservation of earlier assertions. The real port verifies project ownership and refuses consolidation if the source test file already exists. No project files are changed. Original Lead result/execution ID remain intact. Workflow stays paused.
- `revise_plan`: explicitly queue **only Lead** to revise an unplanned graph. The old response is archived before the root task is cleared. No turn starts until a separate Resume. Root attempts and archived responses are capped at three total. The bridge attaches complete prior output and diagnostics as a generated, hashed `project/plan-feedback.json` snapshot; previous output remains untrusted data. Other employees are not restarted. This path was tested using fixtures only, without real Codex tasks.

When a safe candidate cannot be constructed, the workflow remains paused. This mechanism addresses planning validation failures; it does not claim to repair every runtime, dependency, permission or infrastructure error.

## ARMGARAGE recovery

The preserved Lead execution is `wf-cf87600a-5cfd-46b3-8bb1-fe506684b2f9-plan-1`. Its original 5,857-character answer has SHA-256 `ee7c7858cd3827721c4ce1d6e38f688181fe12149f4a041203827d5685255e00`.

The validated proposal replaces planned `tests/ServiceCatalog.test.tsx` with shared `tests/App.test.tsx`. `service-experience` already precedes `app-integration`, so writes remain serialized. The catalogue suite must be retained when integration assertions are added. All five specialist tasks, their existing dependencies and every acceptance criterion are retained; unique scope decreases from nine files to eight. This is a metadata correction, not application or deletion of files.

The original workflow/recovery/permission books and complete Lead response were backed up under the ignored project state before recovery. Coffee House is outside this operation.

## Validation

- Full existing suite plus initial recovery cases: 245 Node tests and six Python tests passed.
- Final focused run, including two added cases for large responses/revision exhaustion and reserved gate collisions: 30 tests passed (eight recovery tests and 22 team-workflow tests).
- TypeScript and Vite production build passed.
- Fresh browser verified diagnostics, original response/fingerprint, correction preview, explicit application, persistence after reload, unchanged Lead identity, eight employees and paused downstream tasks. No page errors, file applications, approvals or real Codex jobs. See `PLAN_RECOVERY_BROWSER_EVIDENCE.json`.

Reproduction: `node --experimental-strip-types --test tests/plan-recovery.test.ts tests/team-workflow.test.ts`; after a production build, `node --experimental-strip-types scripts/verify-plan-recovery-browser.mjs` (uses the existing ignored browser-validation Playwright installation and local Chrome).
