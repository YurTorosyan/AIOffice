# Stabilization verification report

Date: 19 November 2026. Branch: `stabilization/p0-p3`; baseline: `9021ff0`.

P0–P3 implementation is isolated from the running application. **Not deployed; no real Codex tasks, live ARMGARAGE/Coffee House actions or project QA reruns.** P4 remains separate. See [implementation and recovery guide](STABILIZATION_IMPLEMENTATION.md) and [S01–S36 acceptance trace](STABILIZATION_SCENARIOS.md).

## Delivered

1. Durable full-response artifacts, transactional workflow saves, operation journals, atomic permission sets, receipt-based reconciliation, remaining-effect approvals and owned QA recovery.
2. Shared unchanged budgets, feasible-plan admission, full attributed task contracts, required applied inputs and source-manifest freshness checks.
3. Separate evidence states, exact command/receipt matching, web unit/build/browser completeness, source/environment verification identities and independent gates.
4. Selected cancellation recovery, common continuation attempt budgets, unknown execution slot retention, per-task diagnostics and explicit stale/unknown transport state.

Office graphics/assets, animations, employee IDs/roles, registry and Skills are unchanged. The only office UI changes are necessary workflow diagnostics and recovery controls. Vite's Windows security patch and deterministic test-file concurrency are documented in the implementation guide.

## Validation

| Final check | Result |
|---|---|
| Full suite, configured employee slots = 1 | 324 Node + 6 Python passed; 0 failures |
| Full suite, configured employee slots = 2 | 324 Node + 6 Python passed; 0 failures |
| Real fixture process deaths | 70 per suite; 140 total; three-file proposals; no repeated confirmed file writes |
| Production TypeScript/Vite build | PASS; Vite 8.1.6; 12/12 pinned Skill installations verified |
| Fresh browser, 1440 and 390 px | PASS; 8 employees; recovery/reload/offline diagnostics; 0 page errors |
| Dependency audit | 0 reported vulnerabilities |
| Real Codex jobs / live project actions | 0 / 0 |

Final machine-readable results and artifact/log hashes are recorded in `STABILIZATION_EVIDENCE.json`. Detailed logs, process-death fixtures and screenshots remain in ignored `work/` rather than committing artificial project states.

Test environment: Windows; Node 24.18.0; Python 3.14.6; installed Chrome via Playwright 1.65.1. Python validation uses an existing read-only PyYAML helper directory. The browser script accepts `AI_OFFICE_PLAYWRIGHT_ROOT`; it uses its own fresh browser profile, ephemeral loopback server and synthetic state. Neither helper grants agent execution permissions.

The full suite is run with `AI_OFFICE_MAX_ACTIVE=1` and `2`. Dedicated graph scenarios explicitly exercise both slot limits; two-slot regression fixtures intentionally retain their own explicit setting. The test runner itself uses two concurrent files, independently of employee slots. Each process-death matrix has seven windows × ten inputs, with three proposed files. Additional ten-case checks cover lost start/result/receipt acknowledgements and durable publication failures.

Build is the production TypeScript/Vite build. Browser acceptance verifies exactly eight employees, preserved proposal and rejected old approval, fresh pending approval, paused restoration, reload, diagnostic visibility, stale snapshot timestamp, viewports 1440/390, zero page errors and zero real commands/files applied. It does not assert that the mock site's business functionality is production-tested.

## Files and scope

Production changes are confined to persistence/runtime/orchestration/permission/QA adapters, shared orchestration contracts, `WorkflowPanel.tsx`, `useOffice.ts`, package metadata and `.gitattributes`. New modules are `durable-json`, `operation-store`, `operation-reconciler`, `budgets`, `input-contract`, `quality`, `dependency-contract`, `attempt-budget`, `durability`, `recovery` and `diagnostics`.

Tests add crash/runtime/transport/recovery/admission/contract fixtures. Existing tests are adjusted for idempotent confirmation, typed storage errors, profile-aware verification hashes, explicit parallel-fixture slots and genuinely legacy input state. The legacy fixture correction does not weaken production snapshot validation. Documentation includes the approved contract/plan, scope authorization, implementation guide, scenario trace and this report.

## Remaining boundaries

- No rollout to the current bridge or user project state. User-owned untracked files and existing approved document drafts in the original workspace must be preserved during a future merge.
- No real provider/control runs, measured provider quota/cost comparison or production acceptance. Models/cost/quota are not invented from local test timings.
- An uncertain legacy action without sufficient owned evidence stays blocked pending an explicit migration decision; no generic replay or JSON surgery is offered as a successful recovery.
- Hardware/power-loss guarantees and arbitrary natural-language requirement correctness are outside these deterministic tests. Large or unsupported work requires explicit delivery splitting/profile registration.
- Physical QA engines/providers are exercised through controlled adapters here. Existing real isolated QA results of ARMGARAGE/Coffee House are neither rerun nor substituted with these fixtures.

The branch is a reviewable stabilization candidate, not a claim that serious tasks can never fail. Failures now have owned durable evidence and bounded, explicit recovery paths under the supported contract.
