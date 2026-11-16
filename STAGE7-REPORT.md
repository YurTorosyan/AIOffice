# Stage 7 — Security & Permission System

Implemented a conservative permission broker for the existing eight employees. Office graphics, employee IDs/roles, installed Skills and historical checkpoints/results are preserved. Stage 6 was committed and pushed first as `f3884df5625e0585a6977a033a52f71204edde8f` (`feat: implement team workflow`). No Stage 8 work was started.

## Delivered

- Shared role policies and explicit action categories; deny by default, role ceiling intersected with exact task scope.
- Canonical workspace boundary, Windows case normalization, rejection of traversal/absolute paths/ADS/device aliases and symlink/junction escape.
- Central source-transfer and file-effect enforcement, including fixed profile/Skill baseline inputs.
- Exact payload/owner/task/workflow-bound temporary approvals with 15-minute expiry, one-use consumption and durable redacted audit. No automatic approval or permanent escalation.
- Existing diff approval UI extended with risk, task, policy decision and expiry. Old pending/expired/denied requests cannot execute.
- Structured escalation-request boundary, explicit unsupported-executor denial and minimal Codex service environment. No raw credentials, generic shell or arbitrary RPC endpoint.
- Compact Security drawer, Security Engineer all-team policy/audit access and security events in Team Activity. Codex receives only read-only snapshots, including a bounded broker-generated security view for Security Engineer.
- Windows transient replacement locks handled by retrying only atomic rename, preserving original data and never rerunning an agent effect.

## Files changed

New: `src/security/policy.ts`, `server/permissions.mjs`, `server/security.mjs`, `server/atomic-replace.mjs`, `src/ui/SecurityPanel.tsx`, `tests/permissions.test.mjs`, `tests/security-http.test.mjs`, `docs/SECURITY_PERMISSIONS.md`, `docs/stage7-security-preview.png`, this report.

Updated: `AGENTS.md`; `server/employee-config.mjs`, `server/http.mjs`, `server/orchestration.mjs`, `server/rpc.mjs`, `server/team-actions.mjs`, `server/team.mjs`; `src/orchestration/Orchestrator.ts`, `WorkflowClient.ts`, `model.ts`, `team-workflow.ts`; `src/ui/App.tsx`, `WorkflowPanel.tsx`, `useOffice.ts`; `tests/team-actions.test.mjs`.

## Validation

- Entire test command: **175 Node tests PASS, 6 Python tests PASS**, no skipped tests. Includes ownership/scope, approval expiry/replay/substitution/rejection, canonical aliases/junctions, redaction, audit persistence/failure, structured command mismatch, temporary dependency contract, HTTP nonce/origin boundaries, child environment filtering, file effects, existing workflow/office/recovery tests.
- Production build: **PASS**, TypeScript and Vite; 46 modules; JS 353.36 kB (gzip 103.61), CSS 26.61 kB (gzip 6.71).
- Community Skill inspection in test/build prechecks: **12/12 pinned installations verified**, 3 candidates remain uninstalled.
- Browser: separate `127.0.0.1:18787` preview, full existing TeamRuntime state, in-memory security ledger, model detection unavailable. Verified eight selectable employees, preserved illustrated office, role display, Security Engineer all-team drawer, deliberately blocked protected-source write and the same denial in Team Activity. Screenshot: `docs/stage7-security-preview.png`. Preview server stopped after inspection; no real Codex jobs launched.
- Earlier failing checks were resolved: broad credential-redactor matched ordinary authorization source syntax; source declaration was rewritten without weakening secret detection. A transient Windows receipt-file rename denial now has bounded rename-only retries. An incomplete preview fixture caused a blank screen and was replaced with complete runtime state; this was a fixture error, not a successful browser result.

## Remaining limitations / release state

**The protected production bridge has not loaded Stage 7.** Its employee connections were safely closed, but Windows denied stopping PID 11212. An earlier restart attempt was rejected by automatic approval review with “blocked by policy”; after explicit authorization, Windows still returned Access denied. No elevation, forced bypass or second production writer was used. Owner restart is still required; the next startup line says `Stage 7 permissions`.

**No verified isolated executable runner is available.** Installed Codex 0.144.5's Windows sandbox probe failed; installed Node 24.18 does not provide the newer network permission flag. Stage 7 therefore blocks host test execution, dependencies, network and Git execution instead of falling back to unrestricted host code. Previous Stage 6 test receipts remain historical evidence. New real QA cannot complete until an isolated executor is implemented and verified. The temporary escalation contract is tested with injected capabilities, not falsely presented as a working package installer.

The broker is not a defense against a hostile local administrator racing filesystem changes. Local audit is bounded, not a signed permanent forensic record. See `docs/SECURITY_PERMISSIONS.md` for enforcement boundaries, official references and remaining executor/race-hardening work.

The implemented security core is committed; full production activation and real isolated execution remain outstanding. No real Stage 7 end-to-end Codex completion is claimed.
