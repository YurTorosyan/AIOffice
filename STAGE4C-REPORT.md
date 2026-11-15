# Stage 4C — eight real Codex employees

Implemented on 2026-11-15. Stage 5 was not started. The approved illustrated office and its asset files are unchanged.

## Result and architecture

All eight existing employees authenticated against the installed codex-cli 0.144.5, discovered their approved installed Skills and completed real read-only role tasks. Seven new specialist tasks were run; Lead continued its pre-existing paused task. Completion was taken from actual turn/completed notifications, not timers, response text or mock events.

Each employee has a separate AppServerRpc stdio process, profile, runtime state and checkpoint partition. New jobs create persistent threads. Pause/resume continues the same owned task and original thread; a healthy thread-restoration rejection permits a checkpoint reconstruction into a new owned thread. Cross-employee task IDs and shared thread ownership are rejected. Historical Lead data is preserved in the original recovery.json.

The common TeamRuntime handles explicit connection/lifecycle commands and capacity only. There is no automatic assignment, shared conversation, result transfer, dependency scheduler, delegation or orchestrator. Two explicit turns may run concurrently; configuration permits a sequential cap of one. Full eight-way simultaneous execution is intentionally not enabled or claimed.

## Skills actually supplied

| Employee | Typed Skill inputs and final-result references |
|---|---|
| Lead Developer | planning-and-task-breakdown; context-engineering; code-review-and-quality |
| UI/UX Designer | frontend-design |
| Frontend Developer | vercel-react-best-practices |
| Backend Developer | api-and-interface-design; source-driven-development |
| SEO Specialist | seo-audit; schema |
| Security Engineer | security-and-hardening |
| QA Engineer | test-driven-development; webapp-testing |
| Technical Reviewer | code-review-and-quality |

The 12 existing verified Skills cover 13 role assignments, including shared Code Review. Each role's existing TOML is explicitly supplied as developer instructions. Registry/profile ownership, assignments, physical receipts and enabled canonical Skill paths are checked. Start and resume both submit named markers plus typed skill input items. Every live final answer explicitly referenced its assigned Skills. Available/unverified catalog entries, including UI/UX Pro Max, were not installed or invoked.

## Real verification

- Eight unique real thread IDs and eight completed owned tasks were observed. All members had healthy persistence after the Windows write fix.
- Frontend and Backend ran concurrently and completed independently. A second pair, Designer and SEO, was sampled while both were working.
- Designer was paused with confirmed runtime interruption while SEO continued. Resume retained Designer's task ID and original thread ID and completed normally.
- Lead's pre-existing task was restored from disk and completed through its original Codex thread. No replacement Lead task was created.
- SHA-256 values for 32 approved context files were unchanged during the real verification interval. Agents made no repository changes. Each role received only its own profile/context, not other employees' answers.
- Browser confirmed eight correct employee/connection/thread panels, actual Completed/100% states, task history and activity. Mock QA start/pause/resume/completion remained explicitly simulated and did not change any real task/thread.
- At 390 x 844, document width was 375 with eight employee targets and usable controls. No browser console errors/warnings were observed.

Machine-readable evidence: [docs/STAGE4C_EVIDENCE.json](docs/STAGE4C_EVIDENCE.json). Browser evidence: [completed office](docs/stage4c-office.jpg), [Designer checkpoint](docs/stage4c-paused-designer.jpg), [mobile mock](docs/stage4c-mobile-mock.jpg).

## Permissions and recovery

All real jobs remain read-only with networkAccess=false, on-request approvals and user review. Thread-local configuration disables command execution, delegation, apps/plugins/hooks, automatic MCP dependency installation, memories and web search. Additional permissions can only be declined or stopped; write grants were not added. Context uses reviewed fixed paths and bounded hashed snapshots, excluding credentials, environment files and private recovery data.

Storage merges one validated owner partition synchronously into the latest atomic book. A live check exposed a transient Windows destination-file lock. Bounded atomic-rename retries and redundant-write avoidance fixed it; permanent-denial tests confirm the original book is preserved and only the failed temporary file is cleaned. Unknown outcomes and verified limits remain paused/recoverable, never false success. Automated fixtures cover all eight employees across restart, reconnect, original-thread recovery, context fallback, limits and denial-only permissions.

## Review findings and corrections

The real Reviewer identified an obsolete Lead-only dispatch message. Lead identified a stale Lead-only checkpoint decision prefix. Both were corrected after the real run, together with inherited profile/message wording; targeted checks cover the actual role and employee ID for all eight profiles/checkpoints. Historical checkpoint records remain readable and are not rewritten simply to change their wording. No extra model reruns were used for these text/metadata corrections.

Security identified inherited local trust-boundary limitations: child Codex processes inherit the host environment, and session/snapshot endpoints trust processes of the same local user rather than authenticating separate Director accounts. This stage does not add authentication or weaken the existing boundary. The browser does not receive runtime credentials, model context contains only approved snapshots, command tools are disabled and the bridge remains loopback/Host/Origin/nonce restricted. These findings are recorded as limitations, not represented as a blanket security approval.

## Automated verification and build

- Full suite: **97 Node tests and 6 Python tests passed**. The initial Python manifest check encountered an obsolete local PyYAML path; a fresh ignored test dependency directory resolved it. No dependency/package changes were made to the application.
- Post-review checks: 11 adapter/visual tests passed; the parameterized role test additionally verifies all eight checkpoint decision prefixes and role-neutral snapshot instructions.
- All 12 pinned Skill installations and eight TOML profiles passed validation.
- Production build passed: 38 modules; JS 289.82 kB, gzip 85.84 kB; CSS 25.26 kB, gzip 6.43 kB.
- Diff review confirms no changes to public/art, employee IDs/roles or installed Skill files.

## Changed files

- Runtime: server/pilot.mjs, checkpoint-pilot.mjs, checkpoint-store.mjs, http.mjs; new employee-config.mjs, team-store.mjs, team.mjs.
- State/contracts: src/checkpoints/model.ts; src/integration/runtime.ts, RealCodexAdapter.ts, MockCodexAdapter.ts.
- UI: src/ui/useOffice.ts, App.tsx, Office.tsx, RuntimePanel.tsx, TaskPanel.tsx, AgentSkills.tsx, style.css. Changes add connection details and employee targeting; artwork/layout identity remains intact.
- Profiles: the existing eight .codex/agents TOML files received Stage 4C authorization wording, preserving identity, role and assignments.
- Tests: new team.test.mjs, team-adapter.test.ts, team-assignment.test.mjs, team-http.test.mjs and checkpoint-storage.test.mjs.
- Documentation: AGENTS.md, ARCHITECTURE.md, PROJECT.md, README.md, docs/TEAM_STRUCTURE.md, docs/TEAM_RUNTIME.md, this report, sanitized evidence and three browser captures.

## Limits and stop point

Jobs are fixed role-specific analyses, not arbitrary write tasks. Account/provider quotas remain shared. Verified-limit handling and reconstruction fallback were tested with protocol-shaped fixtures; no real account exhaustion was forced. Original-thread recovery and two simultaneous turns were verified live. Complete Codex conversations remain in their persistent threads; the office is not a transcript browser. The final metadata wording is loaded on bridge restart without repeating model tasks.

The implementation follows the reviewed [official App Server protocol](https://learn.chatgpt.com/docs/app-server) and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference), checked against installed CLI schemas. No real Codex API was invented. Stop at Stage 4C and wait for Director approval before Stage 5.
