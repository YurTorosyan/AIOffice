# Attributed input snapshots and integration continuation

The integration task previously received only its write scope and direct dependency summaries. It could not inspect already applied component/domain interfaces or the transitive design handoff. Its missing-input report then referenced those dependency files, which the persisted-finding validator incorrectly treated as unapproved write targets. Saving failed after the live result had already been assigned.

## Read context, separate from write scope

`buildTaskInputs` traverses the task's dependency graph. Only completed ancestor results and their exact approved file-application receipts contribute input sources. It records a bounded list of read-only files plus attributed summaries, decisions, code information, acceptance criteria and verdicts from transitive ancestors, including the designer. No arbitrary file list or glob is accepted from a model or HTTP request. Saved inputs are checked against their graph and receipts.

The real bridge reads fresh canonical, hashed source snapshots under the existing permission authority. Dependency inputs use the existing `baselineFiles` read-only mechanism. They do not expand the task's proposal paths, output-schema enum, write permissions or command scope. Source snapshots retain the existing size, secret and symlink/junction checks. Complete attributed handoffs are delivered in generated `project/upstream-handoffs.json`; they are data, not executable instructions. Input budgets are bounded and admission failures are reported on the task before execution.

## Findings and persistence

Ordinary defect findings retain their responsible implementation owner's write-scope check. A blocked implementation result with no patches may additionally reference the exact read-only inputs available from its approved dependency graph. Such a reference grants no file-writing permission and does not pass a gate.

The orchestrator validates a staged non-planning result against team integrity before assigning it to the live graph. An unrelated/invalid reference therefore becomes a rejected task result in a valid saved workflow, rather than poisoning the checkpoint store. Real filesystem failures continue to fail closed.

## Explicit continuation

`retry_with_context` requires a paused workflow, a completed owned execution reporting missing inputs, no patch/application proposal and no active employees. All affected downstream tasks must be unstarted. It creates one continuation of the same employee/type, Skills, acceptance criteria and write scope. The original blocked result and execution ID remain immutable history. Dependencies include that original result as remediation evidence. Pending consumers, including QA, depend on the continuation instead of the old blocked task. Duplicate preparation is refused; at most two context continuations are allowed per workflow. No task starts until explicit Resume.

The employee panel exposes this preparation action for eligible missing-input results. It does not approve changes, apply files or launch an employee.

## ARMGARAGE repair

The original Frontend response for `app-integration` is preserved in the workflow and as exact raw text in an ignored project-state backup. Its SHA-256 is `59480d545e1bec884a21e8aef1fe2d1b0513f057e576977ff8c7a28f5e9b64da`. The invalid live response had prevented the earlier process from saving; the saved book, live response, runtime recovery and permissions were backed up before checkpoint recovery. A validated paused book was installed while the old scheduler was blocked with no active employees. The restarted bridge loaded it without recovery errors.

Only `app-integration-context-1` is prepared, with unchanged write scope:

- `src/App.tsx`
- `src/styles.css`
- `tests/App.test.tsx`

Its read context includes the fresh ServiceCatalog, BookingDialog and domain sources, associated approved tests and transitive design handoff. A memory-only preflight confirmed all required sources exist, the prompt fits its 10,000-character budget (8,557 characters) and additional snapshots total 64,839 characters. The original blocked execution and all prior approvals remain intact. All six applied file hashes are unchanged. QA depends on the continuation, has no execution ID and still requires explicit test approval. The workflow is paused; no Codex job, QA execution or file reapplication occurred during repair.

## Validation

107 targeted tests passed covering task inputs, workflow, orchestration, plan recovery, implementation handoff, file effects, permissions/security HTTP and resource policies/polling. New tests verify fresh approved source snapshots, transitive design attribution, unchanged write scope, denial of dependency writes, strict input binding, original-result preservation, duplicate prevention, continuation-only scheduling and atomic rejection of unrelated finding references. Production TypeScript/Vite build passed. The Mock browser verified preparation, unchanged original response/receipts/write scope, pending continuation/QA, dependency rewiring and persistence after reload, with eight employees and no page errors. See `CONTEXT_RECOVERY_BROWSER_EVIDENCE.json`.
