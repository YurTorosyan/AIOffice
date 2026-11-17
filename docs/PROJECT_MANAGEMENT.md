# Stage 8 — Projects and repositories

The pixel office, eight employee IDs, Skills and Stage 4B–7 services remain in place. `ProjectManager` owns explicit project selection; it constructs a project-scoped `TeamRuntime`, `Orchestrator` and the existing Stage 7 `PermissionAuthority`. UI components transport commands and display snapshots.

## Models and persistence

`src/projects/model.ts` defines Project (`ACTIVE`, `ARCHIVED`, `ERROR`), RepositoryInfo and ProjectContext. Projects contain an immutable workspace root/physical identity, description, repository, default branch and creation/update/open timestamps. Repository metadata records availability, validity, provider, sanitized origin, branch/default branch, dirty state, commit and refresh timestamp. Unknown state remains unknown; local repositories do not need a remote.

ProjectContext carries project ID/name, workspace, repository/branches, active task, relevant Skills, security policy and runtime mode. It is passed to adapters, scheduling, execution, checkpoints and permissions. Employee sessions retain project, task and thread/turn ownership.

The application stores its catalog at `.ai-office/projects.json`. The existing `office-demo` project retains its original recovery/workflow/security files. Other projects use separate application-owned `.ai-office/projects/<id>/.ai-office/` books; importing never writes into the imported workspace. A small separate Stage 7 authority audits Director catalog operations, allowing recovery/selection even when the previously selected workspace has disappeared.

Legacy tasks without additive metadata belong only to `office-demo`. Existing checkpoints already have project IDs. Before the first additive rewrite of legacy server recovery/workflow books, the storage saves an exclusive `*.pre-stage8.bak` copy. Invalid books are preserved and execution is blocked. Workflow rootTaskId/currentStage are derived without deleting completed tasks, decisions or receipts. Restoring a workflow pauses interrupted execution; it never starts a model automatically.

## Registration, selection and isolation

Create/import registers an **existing independent directory**. Name, description and absolute workspace are user inputs; Git/origin are detected read-only. No folder scaffolding, clone, Git initialization or remote rewriting occurs. Roots must be canonical, accessible, distinct and non-overlapping; parent traversal, linked/junction roots, system/credential directories and shared/external Git worktrees are rejected. Physical directory identity is checked again before operations and on restart, so recreating the same path does not silently redirect work.

Selection is persisted. Switching first requires agents/workflows to be stopped or paused, waits for in-flight runtime commands, disposes old connections/scheduler and creates the selected scope. Archiving retains files/history and clears selection when necessary; reactivation does not automatically select or resume it. Missing selected roots remain selected in ERROR with a manual-recovery message. No fallback to another workspace or branch occurs.

Each task, event, workflow and checkpoint has a project association. Workflow dependencies resolve only inside their owning validated graph. `TaskSystem.query` and read-only `GET /api/projects/tasks?projectId=...` support employee, status, priority, workflow, createdAfter/Before and updatedAfter/Before filters. The HTTP query requires the current project; it cannot enumerate dormant project tasks. Workflow tasks carry update timestamps; standalone recovery tasks derive the last update from their checkpoint/completion.

Checkpoint restoration checks project/employee/task ownership and workspace. Resume additionally passes the project guard, Stage 7 source validation, branch and original runtime/thread reconciliation. A foreign/missing/moved workspace or task is blocked for manual recovery. Old checkpoints with no recorded branch do not invent one. The existing explicit original-thread/continuation behavior is preserved.

External-project sessions use their own workspace as Codex cwd. Employee profiles and installed Skills are discovered from the trusted AI Office service root; fixed `@service/` references pass through the same Stage 7 authority. Only role-approved snapshots and compact ProjectContext are attached. No generic shell, arbitrary RPC or filesystem endpoint is introduced; Codex stays read-only.

## Repository operations and approvals

The compact project panel exposes refresh, status, local branches, working/staged diff summaries and recent commits. Refresh detects local changes, branch/HEAD/origin changes and repository loss. It does **not** contact the remote or claim upstream freshness without an approved fetch.

Fetch, pull, existing-branch checkout, exact-file commit and push require a Stage 7 one-use, expiring Director approval. The visible plan binds project/repository, branch, HEAD, repository-state fingerprint, file hashes, message and HTTPS origin. Execution revalidates this plan; changed state requires a new request. The authority records preparation, decision and execution; project events record outcomes/commit hashes without raw credentials. Concurrent project switching and runtime mutations are blocked during repository writes.

Git runs through a fixed binary and structured arguments. Hooks, fsmonitor, external diff/textconv, submodules, arbitrary helpers, config includes and custom filters/drivers are disabled or rejected. Global/system config is excluded; only validated user.name/email may be read for commit identity. Official bundled Git Credential Manager may use an already configured credential, with prompts and tracing disabled. AI Office does not collect/display credentials or initiate login. Network actions support credential-free HTTPS origin on port 443 only, with redirects disabled. See [Git configuration](https://git-scm.com/docs/git-config), [Git status optional locks](https://git-scm.com/docs/git-status), and [GCM configuration](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/configuration.md).

Pull fetches an explicit branch then permits only a fast-forward to the fetched immutable commit. Checkout requires a clean workspace and an existing local branch. Reset, clean, force push, deletion of branches, overwrite and arbitrary commands are unavailable. Authentication/network/push rejection/divergence failures are actionable and never trigger an automatic retry, reset or branch switch.

Exact commits construct a temporary index from HEAD and approved text bytes, bypass filters, create the commit and compare-and-swap the branch. Unrelated staging is preserved. Index races/cleanup failure after a successful commit are returned as receipt warnings, so a created commit is not falsely reported as uncreated. Binary files, submodules, linked Git metadata and unsupported configurations need an external reviewed Git tool. The app control plane cannot be rewritten by its own agents through repository actions.

## Mock and real modes

Mock has its own project catalog, selected project, task/activity state, recovery/workflow keys and simulated repository metadata. Existing Office keys remain compatible. Mock changes explicitly say MOCK and never run real Git. The pure Stage 7 policy checks simulated requests, including exact approval, expiry, stale-state and project ownership. Manual interrupted tasks are paused with a checkpoint on reload. Mock Git pending approvals are session-only; after reload a new simulated approval is required.

Real mode uses ProjectManager and actual local Git. It never substitutes Mock success on errors. All eight independent Codex sessions retain the reviewed existing App Server contract, snapshots, Skills, pause and checkpoint behavior. Stage 8 verification uses RPC fixtures, **not new Codex model jobs**. Production must restart its bridge to load changed server code.

## Recovery and practical limits

Unavailable/corrupt catalog or permission storage blocks execution and preserves originals. Recover the original root/book, then explicitly reopen/refresh the original project. Do not edit a checkpoint's project/root to bypass recovery. Branch mismatch requires explicitly returning to the recorded branch through approved Git or manual reviewed tooling. Workspace identity recovery and malformed-book repair are manual.

One repository must live at its workspace root. Network shares, nested projects, linked/shared worktrees, binary commits and custom Git execution features are intentionally unsupported. Test workspaces under ignored `work/` are disposable fixtures, not user projects. Network Git argument/error behavior is fixture-tested; no external repository was fetched/pulled/pushed by the application during Stage 8 validation. Canonical checks prevent accidental cross-project access; they are not an OS security boundary against a hostile local administrator racing filesystem changes or hard links. QA code execution retains the separate verified Docker isolation described in [QA_ISOLATION.md](QA_ISOLATION.md).
