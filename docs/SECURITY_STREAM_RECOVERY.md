# ARMGARAGE Security recovery and current diagnostic gates

Security's first turn began receiving an agent message but never produced an item completion or terminal turn event. The native session had no persisted visible assistant message. AI Office deliberately discarded incremental text and only recorded the first delta event, so the earlier partial text could not be recovered from its checkpoint or native session. The original checkpoint, task identity, thread identity and observable event history were preserved; no partial text was invented.

An explicit interruption was confirmed by Codex. A same-process resume accepted a new turn but produced no model stream. Native logs showed that subsequent outgoing messages were `skills/changed` service notifications, not response progress. No rate-limit classification or completion was inferred from silence. The precise upstream cause of the stalled original stream was not established.

After another confirmed stop, only Security's app-server connection was disconnected and reconnected. Resuming the same task in the same original thread then completed successfully. The complete response (5,084 characters, SHA-256 `f60cf3e289af50336e82e161b21a3e5abe1fd59d6ec75cccb2ffefb1b264334b`) was archived. The verdict was BLOCKED because the browser journey stopped at the `service-dialog` hook before privacy/network/storage assertions. Static analysis did not establish a data leak. The orchestrator prepared the next bounded corrective task for the original service implementation owner.

## Diagnostic preflight correction

The old complete-history input context also includes the first QA failure whose browser output was truncated. Requiring complete diagnostics from **every historical failure** would incorrectly block the new correction despite a full current-gate report.

Preflight now checks failed browser receipts from the correction's explicitly named remediation gates. All of those current failures still require complete reports. If no named remediation gate supplies a failed browser receipt, the conservative historical check remains. Old results stay attached as history and are neither rewritten nor converted into passing evidence. Artifact integrity/ownership/committed-operation checks remain unchanged.

Regression coverage rejects missing current reports, incomplete reports from another named current gate, unrelated replacement reports, and continuations that have no direct current-gate evidence. Thirty-four related tests and the production TypeScript/Vite build passed.

## Preserved state

The original Frontend BLOCKED response, completed task results, approved applications and nine ready source/test files remain unchanged. No QA command or file application was replayed during this recovery. The workflow paused after the Security BLOCKED result; `fix-2-0` is pending within the existing two-file service scope. Loading the preflight patch requires a bridge restart before explicit continuation. This change does not add a watchdog, persist future stream deltas, or claim that the original upstream stream defect was fixed.
