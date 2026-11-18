# Implementation handoff before downstream QA

An implementation may already be approved and applied while its author honestly reports that browser checks have not run. Previously a historical implementation `BLOCKED` verdict prevented the application integration on which those checks depended. The graph could remain running without any eligible task.

This change separates an applied implementation handoff from a passing verification gate. It does not rewrite the model's verdict or create passing test evidence.

## Explicit Director decision

`defer_verification` accepts a task ID while its workflow is paused and employees are inactive. Eligibility is deliberately narrow:

- The task is a completed implementation with a `BLOCKED` result and applied patches.
- Every finding is low/medium severity, attributed to that task and scoped to its files. Its English message explicitly describes browser/test/build/verification checks not performed/run/executed. Messages describing failed checks, defects or regressions are rejected. Unrecognized wording requires investigation, not automatic classification.
- An approved application receipt matches the original patches and reported applied paths.
- The registered QA gate has not started and depends on the source implementation.
- The real execution port verifies project ownership and that the applied scope still matches its approval revision.

Candidate detection only enables an explicit decision; it never schedules work or automatically defers a finding. The broker records `WorkflowTask.verificationDeferral` with the QA task ID, finding IDs, source execution ID, approved patch receipt ID and timestamp. The original result, findings, execution ID, attempts and approval history remain intact.

An implementation, QA, Security or SEO task may consume this applied handoff. QA/security/review gates themselves retain the original strict success rules. Completion additionally requires an approved passing QA receipt and trusted evidence (`runner` for real workflows, `mock` for fixtures). A failed QA gate still creates bounded corrective work. New corrective tasks do not inherit the old deferral.

## Order and UI

Existing QA dependencies already include all implementation tasks, including application integration. Therefore QA stays pending until integration is completed and its exact diff is approved/applied. Test execution still needs a separate exact Director approval. Security, independent Review and final Lead integration remain required according to the existing graph.

The UI previews the findings and offers “Передать непроведённые проверки в QA” only for eligible tasks. It requires a paused workflow and shows that the original `BLOCKED` remains preserved. Handoffs carry the exact deferred findings and QA destination. Implementation instructions now distinguish unperformed downstream checks from real implementation blockers; unperformed QA checks still cannot be claimed as passed.

## ARMGARAGE

Director explicitly approved deferring finding `frontend-browser-verification-blocked` from `service-experience` to `gate-qa-0` in workflow `cf87600a-5cfd-46b3-8bb1-fe506684b2f9`. The live action succeeded after bridge reload. Both dependencies of `app-integration` are now satisfied. The workflow remains paused; integration and QA have no execution ID. All six previously applied files retain their hashes. Original results and approval history are unchanged. No file was reapplied, no Codex task was started and no project QA command was executed during this repair.

## Validation

- 91 targeted existing/new tests passed across workflow, orchestration, plan recovery, file actions, permissions and security HTTP. A final focused run passed all six deferral tests, including QA failure/remediation after deferral.
- 11 resource/polling tests passed.
- TypeScript and Vite production build passed.
- Browser fixture verified explicit deferral, preserved original verdict/receipts/execution, paused pending integration and QA, reload persistence and eight employees, with no page errors. See `DEFERRED_VERIFICATION_BROWSER_EVIDENCE.json`.
- A memory-only preflight using the actual saved ARMGARAGE context confirmed the integration prompt fits the 10,000-character limit (9,180 characters) and retains the deferred finding.
