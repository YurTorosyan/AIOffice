# Stage 9 — implementation report (2026-11-17)

Stage 9 is implemented. No following stage was started. No new real Codex model jobs were launched during implementation, regression tests, browser acceptance or bridge activation.

## Components and strategies

- `ResourcePolicy` defines structured task analysis, conservative validated configuration, runtime model profiles, reasoning preferences, Skill selection and failure/retry decisions. `ResourceOrchestrator` owns scoped decisions, active leases, internal workload pressure, usage and events; it is a service, not a ninth employee.
- Model selection uses the actual runtime `model/list` response. It retains the advertised default when appropriate, may select an advertised high-reasoning alternative for complex work, and omits overrides when capability/default information is unavailable. Price, speed, provider quota and model coding strength are not invented.
- Reasoning uses low for simple structured tasks, medium for routine work, and high for architecture/security/critical review, large scope/dependencies or repeated corrective failures, only when advertised. Unsupported requests fall back safely and are recorded.
- Concurrency defaults to global/project 2, per agent 1. Dependency order remains in the existing scheduler. Conflicting/unknown write scope, critical/heavy work, elevated pressure and verified limits reduce or stop new admission. One active project runtime preserves the existing global project boundary.
- The existing installed Skill registry is reused. Turn inputs include only required relevant Skills; exact task scope, compact handoffs, profile and ProjectContext replace redundant broad context for scoped work.
- Escalation changes a later execution/continuation, retains checkpoint/task/completed dependencies and never grants additional access. Simpler independent work may de-escalate. Only confirmed structured transient/retryable failures receive bounded delayed automatic retries (maximum two); other failures remain explicit recovery/remediation/Director decisions. Pause/cancel/restart disables a scheduled automatic retry.
- Verified limits preserve Stage 4B checkpoint/stop confirmation and pause. Resume revalidates the original project/workspace/branch/task/agent, sources/permissions and model catalog, then continues the original thread or supported checkpoint continuation. No completed upstream work is repeated.
- Mock simulates model profiles, reasoning, independent/dependent tasks, escalation, retry, pressure, limit, checkpoint and resume without provider usage. Real integration continues through the existing App Server protocol, using supported `turn/start.model` / `effort` fields and owned token notifications.
- Compact resource details and events were added to the existing UI. Pixel office, assets, CSS, animations and exactly eight employee IDs/roles are unchanged. Fast project switching now aborts obsolete UI polling while retaining stale-project rejection in the server.

Architecture, configuration, provenance, recovery and reproduction: [RESOURCE_ORCHESTRATOR.md](RESOURCE_ORCHESTRATOR.md).

## Verification

| Check | Verified result |
|---|---|
| Full `npm test` | **213 Node + 6 Python tests PASS**, zero failures |
| Final RPC/hash checks | **2 PASS**, including the exact transferred ProjectContext digest in the checkpoint |
| Production build | **PASS**, TypeScript + Vite, 56 modules; JS 417.68 kB / gzip 122.14 kB, CSS 26.61 kB / gzip 6.71 kB |
| Agent/Skill validation | **PASS**, 8 profiles/employee definitions, 12/12 pinned installed Skills; catalog candidates remain uninstalled |
| Browser acceptance | **PASS**, isolated fresh headless installed Chrome via Playwright 1.65.1; no existing user tabs/profiles used; loopback requests only |
| Browser scenarios | Eight employees/office; real local Git branch and non-Git project switching; simple low-reasoning Mock task; two independent tasks and blocked dependent frontend; escalation; simulated limit -> checkpoint -> same-task continuation; retained completed planning; project isolation/persistence; no fabricated quota |
| Browser errors | **0** console/page errors; obsolete project polling is aborted |
| Real Codex contract | RPC fixtures verify runtime models, supported effort, relevant Skill inputs, unknown-capability fallback, original thread resume, owned usage attribution, sandbox unchanged and project/root/agent/task binding. No real model job performed |
| Production activation | Stage 9 bridge loaded; `office-demo`, 8 employees, 0 active, resources NORMAL, observed usage null, verified isolated QA available |
| Git whitespace validation | `git diff --check` PASS |

Browser evidence: [STAGE9_BROWSER_EVIDENCE.json](STAGE9_BROWSER_EVIDENCE.json), [resources and completed workflow](stage9-resources.png), [limit/checkpoint](stage9-resource-limit.png). Test repositories/catalogs and browser dependencies remain under ignored `work/`; application dependency manifests were not changed.

## Limits

The reviewed integration remains pinned to Codex 0.144.5. Live provider model availability/performance, prices and subscription allowance were not verified by paid execution. Actual capability discovery happens on the user's explicit connection; metadata absence is shown as fallback, not optimized success. Only advertised reasoning capability is used for model comparisons. Internal work units and workload pressure are estimates; observed tokens come only from owned notifications since the current process started. Completed workflow decisions/checkpoints persist, but historical unobserved token usage is unknown. Existing Stage 7/8 restrictions and isolated QA prerequisites remain authoritative. The browser verifier uses a temporary Playwright installation and the documented Windows Chrome/Git locations.

## Files changed

- `AGENTS.md`
- `README.md`
- `docs/RESOURCE_ORCHESTRATOR.md`
- `docs/STAGE9_BROWSER_EVIDENCE.json`
- `docs/stage9-resource-limit.png`
- `docs/stage9-resources.png`
- `scripts/verify-resource-browser.mjs`
- `server/checkpoint-pilot.mjs`
- `server/http.mjs`
- `server/orchestration.mjs`
- `server/pilot.mjs`
- `server/team.mjs`
- `src/checkpoints/model.ts`
- `src/integration/MockCodexAdapter.ts`
- `src/integration/RealCodexAdapter.ts`
- `src/integration/runtime.ts`
- `src/orchestration/MockExecutionPort.ts`
- `src/orchestration/Orchestrator.ts`
- `src/orchestration/WorkflowClient.ts`
- `src/orchestration/model.ts`
- `src/resources/ResourceOrchestrator.ts`
- `src/resources/policy.ts`
- `src/ui/App.tsx`
- `src/ui/ResourcePanel.tsx`
- `src/ui/WorkflowPanel.tsx`
- `src/ui/useOffice.ts`
- `tests/project-runtime.test.mjs`
- `tests/resource-polling.test.ts`
- `tests/resources.test.ts`
- `tests/runtime.test.mjs`
- `tests/team-adapter.test.ts`
- `tests/team.test.mjs`
- `docs/STAGE9_REPORT.md` (this report)
