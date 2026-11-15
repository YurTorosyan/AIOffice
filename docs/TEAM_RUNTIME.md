# Stage 4C — isolated team runtime

Use Node 22.14+ and the reviewed codex-cli **0.144.5**, with the existing local Codex sign-in. Run `npm run build`, then `npm run bridge`. The address remains `http://127.0.0.1:8787`. Mock is the startup mode; the browser never receives account credentials.

Select **Codex team**, then **Подключить всех** for authentication and discovery only. Select an employee and explicitly start **Задание на чтение**. Its panel shows connection, execution, task/thread IDs, profile, Skills, approved context, plan and result. Task Panel checkpoint controls resolve the owner from the selected task ID.

Each job is a fixed, role-specific read-only analysis. Frontend/Backend do not write code, QA does not claim tests or browser checks ran, and Reviewer does not receive other employees' answers. Free-form task authoring, write grants, collaboration and delegation are outside Stage 4C.

## Isolation and concurrency

TeamRuntime owns eight parameterized instances of the existing CheckpointPilot, each with a separate AppServerRpc stdio process/connection. Each new task starts a persistent thread. Original threads/history remain in Codex; notifications are filtered by the owned thread and turn. A new job never reuses another employee's conversation. An unfinished job resumes its owned thread and task.

At most two explicit turns run simultaneously. Starting, resuming, working, waiting and pausing all occupy a slot; reservation happens before asynchronous submission. A third start is rejected visibly, never silently queued or shown as working. Set AI_OFFICE_MAX_ACTIVE to 1 before starting the bridge for sequential execution; only 1 and 2 are accepted. There is no task orchestrator. Provider/account limits remain shared and can be lower than this local cap.

## Skills and instructions

| Employee | Explicit Skill inputs |
|---|---|
| Lead | planning-and-task-breakdown, context-engineering, code-review-and-quality |
| UI/UX | frontend-design |
| Frontend | vercel-react-best-practices |
| Backend | api-and-interface-design, source-driven-development |
| SEO | seo-audit, schema |
| Security | security-and-hardening |
| QA | test-driven-development, webapp-testing |
| Reviewer | code-review-and-quality |

Registry/profile ownership and required assignments are checked. Physical community receipts are verified; enabled Skills must be discovered at their canonical paths. Existing TOML developer_instructions are supplied explicitly. Start and resume both send named Skill markers and typed skill input items, not merely UI labels. Uninstalled catalog candidates are not executed. Discovery is separate from successful task completion.

## Recovery

The existing ignored `.ai-office/recovery.json` and bridge lock are retained, including historical Lead records. EmployeeCheckpointStorage reads/writes only one owner's partition and synchronously merges it into the latest validated global book. It rejects mismatched task ownership and thread IDs shared between employees. One employee cannot overwrite the other partitions.

Manual pause waits for Codex interruption confirmation. Only verified CodexErrorInfo limits cause a limit pause. Disconnect and unknown outcomes preserve context without declaring success. Restart restores unfinished jobs as paused, never automatically running them. Resume restores the original owned thread and same task ID; a healthy restoration rejection or context-window limit permits a fresh owned thread reconstructed from that checkpoint. Transport loss does not silently trigger fallback. Restrictions and Skill injection are retained.

Atomic replacement retries temporary Windows destination-file locks with bounded delays, without deleting the live recovery file. Permanent denial preserves the original book, cleans only the failed temporary file and blocks unsafe continuation. Unchanged partitions avoid redundant writes.

## Permissions

Read-only sandbox, networkAccess=false, approvalPolicy=on-request, approvalsReviewer=user. Extra permissions can only be declined or stopped. Thread-local configuration disables shell_tool, multi_agent, apps, plugins, hooks, skill_mcp_dependency_install, memories and web_search. Global Codex settings are unchanged. Context consists of fixed, size-bounded, hashed per-role repository snapshots; no arbitrary paths, credentials, environment files or private recovery data are included.

## Mock

The original mock workflow and manual Task Panel remain. Eight labeled mock sessions support independent simulated tasks, explicit step/error/limit scenarios and owned pause/resume. All recoverable employee checkpoints restore after reload. Mock IDs/events never represent real execution; its real-connection count remains zero.

## Protocol evidence

Inspected the installed CLI-generated schemas in work/codex-protocol-4c for thread/start, thread/resume, turn/start, Skills and sandbox fields. Current documentation may be newer; unverified new methods are not used.

Primary references: [App Server](https://learn.chatgpt.com/docs/app-server), [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference). Thread-addressed lifecycle and explicit Skill injection follow the reviewed protocol. Actual local concurrency evidence is recorded separately in the Stage 4C report; the documentation alone is not treated as a platform-wide concurrency guarantee.
