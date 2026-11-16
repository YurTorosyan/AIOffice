# Stage 7 — Security & Permission System

Eight existing employees and the illustrated office are preserved. Codex stays read-only, with shell, apps, plugins, hooks, multi-agent and web tools disabled. Permissions do not grant Codex direct OS tools.

## Enforcement

`src/security/policy.ts` defines the eight role policies, structured command profiles, action categories and pure decisions. `server/permissions.mjs` canonicalizes resources, intersects role and exact task scope, stores expiring decisions, consumes one-use grants and records redacted audit events. `TeamRuntime` uses the authority for source/profile/Skill transfer. `TeamActions` shares the same authority for Director-approved effects. React displays results; it cannot grant itself a role or filesystem scope.

The flow is employee → action request → canonical path/role/task validation → approval when supported → consume exact grant → execute → audit. There is no generic shell, arbitrary RPC or arbitrary file-write HTTP endpoint. Escalation requests derive their employee and file scope from a current server-owned task, rather than trusting client fields.

All requested categories are classified: file and directory operations, Git, terminal commands, dependencies, package scripts, network/API/download, configuration and secrets. **Classification is not an implementation of every executor.** Unsupported operations are denied, even if the role could otherwise request them.

## Currently executable operations and deliberate blocks

- Scoped source reads and fixed role-specific bootstrap sources are checked and audited. Fixed profile/Skill sources are an explicit baseline, not model-selected extra paths. Sensitive contents are withheld. Canonical source paths are hashed; the original byte content determines the snapshot hash.
- Exact workflow `file.create`, `file.modify` and necessary `directory.create` operations can be approved. Scope, owner, original hashes and replacement contents are bound to the request. Control-plane source/configuration cannot be changed by employees. Existing Stage 6 project-path restrictions remain in force in addition to the central policy.
- Terminal/test/package/dependency/network/Git executors are **not enabled** on this machine. Requests are recorded as denied with “No confined registered executor”. Dangerous operations, privileged commands and raw secret access have no execution path. No unlimited fallback is available.
- A server-side `confinedExecutor` seam is reserved for a separately verified isolation implementation. A test-only injected capability is not evidence of real OS isolation. No browser or employee can supply this object through HTTP.

This changes the old Stage 6 test-runner behavior intentionally: Director confirmation alone no longer permits arbitrary test code to run in the host environment. QA must report BLOCKED until an isolated executor is configured. Existing completed workflows and historical test receipts remain unchanged. A mock workflow remains explicitly a simulation.

## Roles and scope

Lead can read project evidence within task scope and propose approved implementation work. Design is limited to UI/assets; Frontend cannot write backend paths; Backend cannot write frontend paths. SEO proposals are limited to public/SEO paths. Security can inspect policy and redacted security history, not grant itself privileges. QA can propose test work. Reviewer can independently inspect evidence and propose review documentation. All role ceilings still require a specific current task resource. Git mutation and dependency profiles are classified but not executable by the current broker.

Secret paths (`.env*`, credentials, authentication stores, private keys, secret directories) are forbidden. Permission/control-plane files, office control source, agent profiles, vendored Skills and hidden runtime state are protected against employee writes. The Codex service child receives a small environment allowlist; arbitrary API-key variables and `NODE_OPTIONS` are not forwarded. The service's existing authenticated Codex credential store is used internally by Codex and is never included in model snapshots or browser responses.

## Approvals and recovery

Each record binds workflow, logical task, employee, action, canonical resources, command arguments, policy version and a payload fingerprint. Patch digests bind exact proposed contents and original hash. Grants expire after 15 minutes, are consumed before effects, and cannot authorize a substituted request or repeated execution. Decisions are durable in `.ai-office/permissions.json` under the bridge's existing single-writer lock. Invalid/unwritable history fails closed and is preserved.

The approval panel shows employee, task, action, reason, diff/resources, risk, expiry and policy decision. Denied, expired and pre-Stage-7 pending approvals cannot execute. Reject and create a new workflow/proposal when a pending legacy or expired request must be replaced; historical completed receipts remain readable. Retrying an already completed exact file receipt only returns saved evidence after revision validation; it does not repeat effects. Uncertain partial effects require inspection and a new proposal; no automatic replay.

Temporary dependency grants are supported by the pure policy/authority contract and tested with an injected executor capability. The production broker rejects these requests until a confined dependency executor exists. No permanent role elevation or automatic approval occurs.

## Security review and UI

The compact Security drawer shows the selected role, grants and audit. Security Engineer sees all eight policies, blocked actions and approval history; the same employee receives a bounded, broker-generated redacted audit snapshot for analysis. Security events also appear in Team Activity. The drawer is marked MOCK in simulation. An old bridge is labelled unavailable for Stage 7, not falsely protected.

`GET /api/security/snapshot` exposes the redacted local audit/capabilities. `POST /api/security/request` accepts structured terminal/dependency/network escalation requests only, with same-origin checks, session nonce and body limits. No execution endpoint accompanies it. Current unsupported requests are denied and audited. File approvals stay in the existing exact-diff workflow.

## Canonical paths and threat boundary

Reject traversal, absolute paths, Windows drive/ADS syntax, backslashes, URL-encoded aliases, double separators, reserved device names, trailing dots/spaces and non-ASCII alternate representations. Resolve each existing path component; reject symbolic links/junctions, including dangling links, and paths outside the canonical workspace. Normalize case on Windows. Recheck paths and hashes immediately before effects.

The broker protects against untrusted model/Skill requests. It is **not** an OS security boundary against a hostile local administrator or another process racing directory replacement. The audit is local trusted application data, not a cryptographically signed or permanent forensic log; retention is bounded to 2,000 events and 1,000 approval records. Do not claim isolation of arbitrary executables from these path checks. Native filesystem handle-based race hardening and a verified isolated executor remain open work.

## Runtime evidence and official references

Installed Codex is pinned to 0.144.5. A read-only `codex sandbox windows --help` probe failed with `CreateProcessWithLogonW failed: 2`; no Windows sandbox setup, elevation or configuration change was attempted. Recent documentation features cannot be assumed available in this pinned version. See [Codex developer commands](https://learn.chatgpt.com/docs/developer-commands), [Windows sandbox documentation](https://learn.chatgpt.com/docs/windows/windows-sandbox) and [app-server documentation](https://learn.chatgpt.com/docs/app-server).

Installed Node 24.18 exposes filesystem permission flags but no network permission flag. [Node CLI documentation](https://nodejs.org/api/cli.html#--allow-net) records `--allow-net` as added in v25.0.0. Consequently the Node 24 permission flag alone was not accepted as complete isolation.

The protected existing bridge could not be stopped: Windows returned Access denied. All employee connections were closed and no active model jobs remain. Stage 7 browser verification therefore used a separate loopback preview on port 18787, memory-only audit and unavailable model detection. The screenshot `stage7-security-preview.png` shows a deliberate preview denial, not a live production attack or a real Codex security audit. The initial preview fixture omitted runtime fields and produced a blank screen; replacing it with the complete existing TeamRuntime state fixed the fixture. The protected production bridge has not loaded Stage 7 until its owner restarts it.
