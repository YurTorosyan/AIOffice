# Rejected implementation start and safe recovery

A corrective implementation inherited a failed QA receipt for the whole application. Its write scope contained only three files. Comparing the QA receipt's full-scope revision with that narrower implementation scope incorrectly produced a stale-evidence error before `TeamRuntime.startWork`, after the scheduler had already persisted its execution intent. Subsequent resume correctly refused an execution with no runtime checkpoint.

Implementation tasks now retain upstream receipts as historical context without treating them as verification of their own write scope. Their own receipts still require a matching revision. QA, Security, Review and integration gate checks remain strict. Evidence validation also runs in preflight, before a new execution intent is persisted, and is repeated immediately before submission.

`reconcile_unsubmitted` is an explicit metadata-only workflow action. It is restricted to a paused owned implementation with the exact legacy start-reconciliation error, no own test receipts, result, response reference or checkpoint, and a reproducible legacy upstream-evidence mismatch. It rejects recovery if any employee has the execution in task/checkpoint/state records, unresolved storage, or active work; the owner must have no thread or turn. The owned response archive must contain no artifact for that execution. Unknown missing executions remain blocked.

After those checks, recovery settles the abandoned resource intent, retains the consumed attempt count and start timestamp, and marks only that task ready with no execution ID. The prior ID and proof are recorded in a workflow event. The workflow remains paused. No model request, project command, file application or approval is executed. Subsequent resume is a separate Director action.

## Validation

- 60 existing related tests passed; three added regression tests passed after correcting a syntax error in the new test fixture.
- Production TypeScript/Vite build passed.
- Negative recovery cases cover foreign ownership, unsupported task/error/state, existing task/checkpoint/response, active runtime, thread, storage failure and an unreproducible rejection.
- Read-only diagnosis of the saved ARMGARAGE correction reproduced the legacy rejection and confirmed absence of runtime task/checkpoint/response records. Original QA receipts and ready project files were not altered.
- Live recovery awaits loading the new bridge version. Do not report the task recovered until the explicit metadata action succeeds. No browser check is needed for this server/state change; project QA was not rerun.
