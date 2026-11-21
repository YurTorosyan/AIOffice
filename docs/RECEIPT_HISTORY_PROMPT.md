# Receipt-rich prompt admission

An independent gate with two upstream handoffs exhausted the 10,000-character prompt limit even at the smallest preview level. Emptying log excerpts did not help because immutable operation IDs, approval histories, hashes and report references were still copied into the prompt.

The existing complete `project/task-contract.json`, `project/upstream-handoffs.json` and verified `project/qa-reports/<id>.json` snapshots already carry this evidence. The final prompt fallback now references those attachments and retains the task ID/title, workflow ID, complete write scope, round and source-task/verdict references. It does not serialize duplicate operation histories into the preview. The ordinary three preview levels remain unchanged when they fit.

No requirement, full handoff, report, receipt or permission scope is removed from the authoritative input. The complete input budget remains 100,000 characters, and genuinely oversized contracts still fail closed before model submission. The prompt limit remains 10,000 characters; there is no substring truncation of serialized JSON or automatic token-limit expansion.

Validation: 42 related tests and production TypeScript/Vite build passed. A read-only check against the blocked Security context produced a 3,331-character reference prompt and preserved the 93,326-character complete contract with five full report snapshots. No model request or source write was used for that check. A regression covers large approval histories, complete evidence preservation and failure of an oversized authoritative contract.
