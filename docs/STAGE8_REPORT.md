# Stage 8 implementation report — 2026-11-17

Stage 8 is implemented; Stage 9 was not started. No new Codex model jobs were launched. Stage 7 isolated QA completion is in the preceding pushed commit `fa33b1d`.

## Delivered

- Typed Project, RepositoryInfo and explicit ProjectContext; create/register, read-only import, selection, archive/reactivate, restart persistence and workspace recovery errors.
- Canonical independent workspace roots with physical identity validation, no overlapping roots or linked/shared Git worktrees. No silent fallback when a project disappears.
- Project-owned tasks, employees, event logs, recovery books, workflow graph and permissions. Query by project, employee, status, priority, workflow and time. Legacy additive migration preserves original server books in pre-stage8 backups.
- Scoped Mock and real adapters; existing eight roles, profiles, installed Skills, original thread pause/resume and approval-controlled Team Workflow retained. Branch mismatch blocks continued workflow/checkpoint execution.
- Actual repository detection/refresh and read-only status, branches, staged/working diff and log. Exact expiring Director approvals for fetch, ff-only pull, existing-branch checkout, selected text-file commit and push; destructive commands are unavailable.
- Compact selector/project drawer using existing styles; pixel scene, eight characters, artwork and animations unchanged. No visual asset, employee registry or Codex protocol replacement.

Architecture and operating limitations: [PROJECT_MANAGEMENT.md](PROJECT_MANAGEMENT.md). All file/Git actions reuse the Stage 7 policy/authority; no generic shell or automatic grants.

## Verification

| Check | Result |
|---|---|
| Full `npm test` | **201 Node tests + 6 Python tests PASS**, zero failures |
| `npm run build` | **PASS**, TypeScript + production Vite, 53 modules |
| Production assets | JS 394.87 kB / gzip 115.22 kB; CSS 26.61 kB / gzip 6.71 kB |
| `npm run validate:agents` | **PASS**, 8 profiles/employee definitions, 12/12 pinned community Skills verified |
| `git diff --check` | PASS |
| Real local Git fixtures | Import leaves index/files unchanged; clean/dirty/branch refresh; approved exact commit preserves unrelated staging; approved checkout; stale/secret/destructive actions denied |
| Git network fixtures | Exact approved fetch/pull/push arguments, ff-only/no-force, expiry/one-use policy and redacted actionable auth/rejection/divergence/network errors. No external repository mutation was performed by the application |
| Codex RPC fixtures | External workspace cwd, trusted application Skills, project/task/employee binding, original thread pause/resume, foreign project/workspace/branch rejection. No live model request |
| Browser | Pixel office and 8 employees; create/import 2 Mock projects and 2 real local fixtures; switch and task/context/log isolation; restored selection/tasks after reload; Git main/clean/local originless repo vs non-Git workspace; Stage 7 security/QA panel; existing Mock workflow completed 8/8; console errors/warnings: **0** |
| Production bridge activation | Stage 8 bridge started by this task after finding old bridge stopped. Selected `office-demo`, 8 employees, 0 active; project/workflow recovery errors absent. Docker started; QA startup isolation self-check PASS, `executors.qaTests.available=true` |

Browser evidence: [project/task scope](stage8-mock-project-scope.png), [completed Mock workflow](stage8-mock-workflow.png). Browser checks were performed against an isolated local bridge and production UI assets; test catalogs never replaced the user's production catalog. The final workflow branch guard and corrected security explanation were subsequently covered by tests/build; no additional live Codex verification is claimed.

## Limits

- Creation registers an existing directory; no scaffolding, clone/init or remote rewrite. Origin is discovered, not invented.
- One standalone Git repository at root; nested/network/shared-worktree roots and custom execution config require external review.
- Network Git uses approved credential-free HTTPS origin and cached official Git Credential Manager; no login prompts, embedded credentials, arbitrary helpers or SSH.
- Commits cover exact approved text files. Binary files/submodules and unsupported paths/config need an external approved tool.
- Remote operations are fixture-verified, not executed against GitHub by the application. Real Codex integration is fixture-verified only, honoring the no-new-jobs instruction.
- Mock Git approvals are session-only and require a new simulated request after reload. Mock task/checkpoint/workflow/catalog data is persisted per project.
- Filesystem validation prevents accidental scope escape, not hostile local administrator races/hard links. QA retains verified Docker isolation and refuses execution when unavailable.

## Files changed

- `AGENTS.md`
- `README.md`
- `docs/PROJECT_MANAGEMENT.md`
- `docs/stage8-mock-project-scope.png`
- `docs/stage8-mock-workflow.png`
- `server/checkpoint-pilot.mjs`
- `server/checkpoint-store.mjs`
- `server/http.mjs`
- `server/migration-backup.mjs`
- `server/orchestration.mjs`
- `server/permissions.mjs`
- `server/pilot.mjs`
- `server/project-store.mjs`
- `server/projects.mjs`
- `server/repository-actions.mjs`
- `server/repository.mjs`
- `server/security.mjs`
- `server/team-actions.mjs`
- `server/team.mjs`
- `server/workspace.mjs`
- `src/checkpoints/browser.ts`
- `src/checkpoints/model.ts`
- `src/domain.ts`
- `src/integration/MockCodexAdapter.ts`
- `src/integration/RealCodexAdapter.ts`
- `src/integration/runtime.ts`
- `src/orchestration/MockExecutionPort.ts`
- `src/orchestration/Orchestrator.ts`
- `src/orchestration/WorkflowClient.ts`
- `src/orchestration/model.ts`
- `src/projects/MockProjects.ts`
- `src/projects/ProjectsClient.ts`
- `src/projects/model.ts`
- `src/security/policy.ts`
- `src/security/redaction.ts`
- `src/state/office.ts`
- `src/tasks/TaskSystem.ts`
- `src/tasks/browser.ts`
- `src/tasks/query.ts`
- `src/ui/App.tsx`
- `src/ui/ProjectPanel.tsx`
- `src/ui/RuntimePanel.tsx`
- `src/ui/SecurityPanel.tsx`
- `src/ui/useOffice.ts`
- `tests/project-git-network.test.mjs`
- `tests/project-http.test.mjs`
- `tests/project-isolation.test.ts`
- `tests/project-migration.test.mjs`
- `tests/project-runtime.test.mjs`
- `tests/projects.test.mjs`
- `tests/repository-actions.test.mjs`
- `tests/runtime-adapter.test.ts`
- `tests/state.test.ts`
- `docs/STAGE8_REPORT.md` (this report)
