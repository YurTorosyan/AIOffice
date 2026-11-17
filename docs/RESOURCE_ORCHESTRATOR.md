# Stage 9 — Intelligent Model & Resource Orchestrator

The resource router is a lightweight system service, not an employee. It extends the existing Task System, TeamRuntime, execution ports and Orchestrator. There are still exactly eight employees; office artwork, CSS, animations, project ownership and Stage 7 permissions are preserved.

## Decision pipeline

`src/resources/policy.ts` defines typed task analysis, runtime model profiles, configuration, decisions and retry classification. `ResourceOrchestrator` owns project-scoped decisions, execution leases, pressure, observed usage and events. Both real TeamRuntime and MockCodexAdapter use this service. Execution ports submit structured workflow metadata; the existing scheduler continues to own dependency order, handoffs and durable workflow transitions.

TaskAnalysis uses role/type, exact scope when supplied, priority, dependencies, write proposals, architecture/security requirements, critical review and corrective attempt/round metadata. It does not infer authorization from task text or run another AI merely to classify work. Unknown affected scope stays unknown. Fixed source snapshots are inputs, not a claim that every supplied file will change.

For each execution unit, a ResourceDecision records owner/project/root, analysis, selected model/effort/Skills, priority, parallel decision, reason, fallback, escalation, retry strategy and context character count. Decisions are also stored on workflow tasks and checkpoints. Activity includes analysis, model/reasoning selection, queue/defer/start, concurrency, pressure, escalation/de-escalation, fallback, retries and limit/pause events.

## Runtime capabilities and model selection

On an explicit employee connection, the existing bridge reads `model/list` with bounded pagination. Only visible, well-formed advertised entries without an availability notice are candidates. It uses the response's `model`, `isDefault`, `supportedReasoningEfforts[].reasoningEffort` and `defaultReasoningEffort`. It does not interpret marketing descriptions as capability scores. Provider, price, context capacity, speed, coding/analysis strength and tool support remain null because this catalog does not establish them.

The runtime default model is retained when it supports the desired effort. Complex work may select another advertised model that supports the required higher effort. This is a supported-reasoning choice, not proof that the model is better at coding or cheaper. When the catalog/default is unavailable, the bridge omits model/effort overrides, preserves configured runtime behavior and records a fallback. Unsupported requested reasoning falls back to the advertised model default. Catalog advertisement is not a guarantee that a later provider request will succeed; rejected/unknown outcomes are not silently resubmitted under guessed configurations.

The reviewed Codex 0.144.5 `turn/start` schema supports `model` and `effort`. These fields are used only at a new turn or checkpoint continuation. A running turn is never reconfigured. Existing read-only sandbox, on-request/user approvals, disabled shell/network/delegation and explicit profile instructions stay intact. Local schemas under ignored `work/codex-protocol-4c/` were checked, along with the [official App Server documentation](https://developers.openai.com/codex/app-server).

## Reasoning and Skills

Low reasoning is preferred for structurally small, low-priority independent work; medium for ordinary work; high for architecture, security/critical review, large scope/dependency graphs or repeated corrective failures. These are preferences, not claims about unsupported effort values. Only values advertised for the chosen model are sent.

The existing registry remains authoritative. The request specifies relevant assigned Skills; availability requires installed receipts and runtime discovery. Standalone role tasks use their primary Skill. Workflow tasks use their validated required Skills. Only selected Skills become turn inputs. Verifying the installed registry can inspect receipt files, but this does not send the entire Skill collection to a model. Profiles remain mandatory instructions. Exact-scope workflows reduce fixed source baselines to AGENTS/README/profile plus authorized scope snapshots, compact attributed handoffs and ProjectContext. Complete conversation history is not attached.

## Concurrency and isolation

Default limits are global 2, project 2 and agent 1. Stage 8 permits one active project runtime; dormant projects have no running scheduler, so this single scoped admission gate is also the application's global execution gate. TeamRuntime's existing capacity gate remains a second, stricter bound, including its one-slot configuration.

Dependencies must first be satisfied by the existing scheduler. The resource gate then checks identical project/root, per-employee ownership, live leases, critical/heavy work, pressure and file scope conflicts. Potential write scopes are compared conservatively without case distinctions. Empty-scope tasks cannot propose file writes and can use immutable snapshots; unknown write scope is serialized. Two independent normal tasks can run; heavy reasoning, elevated/high pressure or explicit serial policy reduces admission to one. Verified limit pressure blocks new starts. A stronger model never grants filesystem, Git, terminal, secret or cross-project access. Every actual effect still passes Stage 7 validation and Director approval.

Project switching cancels obsolete UI polling before changing server scope. Abort does not report a connection failure, and existing server stale-project checks are retained. Switching still requires paused/stopped work and never transfers a task to another workspace.

## Usage and pressure

`estimatedUsage` uses relative work units (simple 1, standard 2, complex 3) and optional input character counts. These are internal estimates, not tokens, money or subscription allowance.

`observedUsage` is null until an owned `thread/tokenUsage/updated` notification is received. The service keeps the largest reported `last.totalTokens` for each thread/turn, avoiding duplicate notification double-counting. Foreign thread/turn notifications are rejected by the existing runtime ownership filter. Counters are scoped to the current service process; earlier unobserved provider consumption is unknown. No account quota request, credential or exact remaining subscription allowance is exposed.

NORMAL/ELEVATED/HIGH use internal failure-plus-live-workload indicators with validated thresholds. CRITICAL is tied to a verified runtime limit, or an explicitly labeled Mock simulation. These labels are never represented as official provider quota. Restart restores paused decisions/limit reason from checkpoints, but observed token totals do not pretend to survive a process that did not observe them.

## Escalation, de-escalation and retries

Repeated structured code/retryable/transient failure or corrective rounds can raise the next unit/continuation to high reasoning when supported. Required architecture/security risk can also request high reasoning immediately. Current task/checkpoint IDs and completed workflow results are retained. Simpler subsequent independent units can return to low/standard; running turns do not change. Unknown model strength/cost prevents price-based ranking.

Failure classes are TRANSIENT, RETRYABLE, RESOURCE_LIMIT, PERMISSION_DENIED, INVALID_TASK, CODE_FAILURE, SECURITY_BLOCK, USER_REQUIRED and UNKNOWN. Only structured, confirmed transient/retryable execution failures permit automatic retry: at most two retries, with a short bounded delay, after the old execution is confirmed failed and reconciled. Reviewed `internalServerError`/`serverOverloaded` codes qualify; arbitrary error text does not. A failed unit may need a new execution/thread; confirmed completed upstream work is retained. Unknown or unreconciled outcomes require the Director.

Permission/security/invalid/unknown/user-required failures are not automatically retried. Code/test failures use the existing bounded remediation workflow and exact approvals. A Director pause/cancel disables a scheduled retry; application restart pauses recovery and disables automatic retry until an explicit continuation decision. No retry bypasses model availability, project checks, checkpoint ownership, permissions or concurrency.

Verified usage-limit conditions retain Stage 4B's checkpoint/interruption confirmation, completed/remaining work, decisions, files, employee/project and session/thread information. They are paused, never marked completed. Explicit resume validates the original project/root/branch/task/agent and Stage 7 sources, rechecks live model capabilities, then uses the original thread or the existing supported checkpoint continuation. The saved analysis/Skill selection remains available; completed work is not repeated.

## Configuration

`defaultResourceConfig` is the single policy source. It defines global/project/agent limits, simple/default/complex effort preferences, maximum retries, escalation threshold, pressure thresholds, parallel execution and automatic escalation. Constructor overrides pass `resourceConfig` validation: at most two global/project tasks, one per employee and two retries. There is no HTTP endpoint accepting arbitrary model names, execution commands or unvalidated dangerous settings.

## Mock, tests and browser verification

Mock uses explicitly simulated `mock-standard` and `mock-deep` profiles; these are not names of available provider models. The same policy supports simple work, parallel/dependent tasks, escalation, transient retry, limit, checkpoint and resume. Mock never claims provider usage or performs real Codex/Git execution.

`tests/resources.test.ts` checks policy, capability fallback, concurrency/conflicts, escalation/de-escalation, failure classification, usage attribution, checkpoint/reconstruction and workflow retries. `tests/project-runtime.test.mjs` supplies RPC fixtures for actual integration fields, selected Skills, observed usage, unchanged sandbox, fallback and original-thread resume. `tests/resource-polling.test.ts` covers obsolete request cancellation. Stage 1–8 regressions remain in the full test command.

Browser acceptance uses `scripts/verify-resource-browser.mjs` with a fresh isolated headless installed Chrome profile. It permits loopback requests only and constructs a test bridge whose real Codex RPC creation is forbidden. Temporary catalogs, Git repositories and package dependencies are under ignored `work/`; production projects and user browser sessions are untouched. To reproduce on this Windows installation:

```powershell
npm install --prefix work/browser-validation --no-save --ignore-scripts --no-audit --no-fund playwright@1.65.1
npm run build
node --experimental-strip-types scripts/verify-resource-browser.mjs
```

The script checks the eight-employee office, real local Git/non-Git switching, simple Mock routing, two independent tasks and waiting dependencies, escalation, limit/checkpoint/resume, retained completed planning, project isolation and zero console/page errors. It writes `STAGE9_BROWSER_EVIDENCE.json` and screenshots. Remote provider access and live model performance are deliberately not claimed; no new real Codex jobs are required or launched.
