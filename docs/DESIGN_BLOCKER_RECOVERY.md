# Design handoff blocker recovery

The Coffee House workflow stopped after a completed designer execution returned `BLOCKED`. Completion of an execution does not mean its handoff passed. Frontend correctly waited for a usable specification, but there was no explicit route to resolve that blocker.

Two inputs also contributed: scoped external-project context omitted the actual selected Skill text and sometimes the manifest, and the original plan assigned CSS/test implementation to a read-only designer whose output contract cannot contain patches.

## Context and task ownership

- Attach full verified selected Skill snapshots, fixed team instructions and hashed execution metadata through the existing permission broker. Service references use `@service/` for external projects.
- Retain an existing project manifest in scoped context. Explicitly report missing baseline files and unavailable QA isolation. Absence of a manifest does not establish React, npm scripts or Vitest; no dependencies are installed automatically.
- New design tasks own a specification with empty write scope. Frontend/backend own source, styles and tests. A usable design specification need not claim that downstream implementation/tests/browser checks already ran.

## Recovery contract

1. A completed blocked specification produces one pending Lead resolution and pauses the workflow. Scheduler ticks cannot automatically launch it.
2. Director explicitly resumes the workflow. Lead can accept an existing useful handoff, request a corrected designer handoff, or request a Director decision.
3. Only already planned design artifacts can move to an unstarted implementation owner. Role/path restrictions, eight-file limits and gate evidence remain enforced. Started gates cannot silently acquire new scope.
4. Original results, task IDs and completed executions remain intact. An accepted handoff retains its original `BLOCKED` verdict alongside the attributed Lead decision.
5. Lead cannot waive QA/security/review, high/critical findings, exact change approvals or isolated test execution. Retries are bounded; an unresolved Director decision remains paused.

Existing stored plans with designer artifact scope are retained for recovery rather than re-running the original Lead plan. This repair prepares a decision; it does not assert that the existing design is sufficient or that the target project has the necessary runtime.

## Verification

`tests/specification-blockers.test.ts` covers pause/deduplication, explicit resolution, legacy ownership transfer, bounded retries, Director decisions, gate protections and the new planning contract. The external-project RPC fixture checks actual selected Skill text and missing-manifest metadata without starting a real model job.

`scripts/verify-blocker-browser.mjs` exercises the built application in a fresh local Mock browser: blocked design → explicit Lead resolution → Frontend proposal → pending Director approval. It checks eight employees, original planning retention, pending QA and zero console errors. Evidence: [browser results](DESIGN_BLOCKER_BROWSER_EVIDENCE.json), [paused screenshot](design-blocker-paused.png), [resolved screenshot](design-blocker-resolved.png). Its optional browser tooling lives under ignored `work/browser-validation`; it adds no application dependency.

Before updating the live bridge, the original project workflow JSON was copied beside itself with a `before-design-blocker-fix` timestamp and matching SHA-256. After restart, all seven original task results/execution IDs and approvals were compared with that backup. The workflow is paused with `lead-blocker-1` pending, no execution ID and no active employees. No new real Codex job was launched.

To continue real work, connect the required employees and explicitly choose **Продолжить workflow**. Any subsequent proposed file changes still require Director approval.
