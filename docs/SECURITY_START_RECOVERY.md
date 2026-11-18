# Security recheck start recovery

The repeated Security task failed before runtime registration: its generated prompt was 11,158 characters, exceeding the bridge's unchanged 10,000-character admission limit. All three QA receipts still match the current verification revision. No Security thread/turn or checkpoint was created for this failed execution.

Team prompts now fit the shared admission budget by progressively reducing explanatory text and log excerpts before serializing complete JSON. Exact scope, acceptance criteria, action receipts, gate verdicts and the three checks' commands/status/exit code/revision/source are retained. Persisted task context and full QA evidence are not modified. The saved Security context now produces an 8,919-character prompt. Context that still cannot fit fails explicitly rather than truncating JSON or increasing the limit.

Normal retry previously required a registered failed runtime task, so this preflight rejection could not recover. The new narrow recovery path requires the original oversized prompt, matching project/workspace, a recoverable failure below the retry limit, no matching task/checkpoint in any employee, and a connected idle owner with no task/thread/turn or recovery error. Registered or uncertain executions remain denied. Retrying prepares only the existing Security task and leaves the workflow paused; it does not start a model job, apply files or repeat QA.

Original workflow, recovery and permission files were backed up under the project state directory in `before-security-start-fix-1794987484674`. Verification used only the saved context and an in-memory preflight fixture; see [preflight evidence](SECURITY_START_PREFLIGHT_EVIDENCE.json). Type checking and the AI Office production build passed. Per Director instruction, the project tests, QA suite and existing full test suite were not rerun. Existing passing QA receipts and the once-applied Coffee House files remain authoritative.

Reload the bridge, reconnect the employees and explicitly retry the failed Security task. Resume the paused workflow when ready. Repeating file application or requesting another QA run is unnecessary for this repair.
