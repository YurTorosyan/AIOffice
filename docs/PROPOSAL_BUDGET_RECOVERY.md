# Proposal budget diagnostics and formatting recovery

ARMGARAGE's saved integration response exceeded the combined patch limit by **53 characters**: 24,053 proposed characters across three distinct files, against a 24,000-character total. Individual files were valid (8,149, 7,672 and 8,232 characters, each under 12,000). No file-count, scope or duplicate-path violation occurred.

The complete 27,552-character Frontend final answer was recovered from the exact saved Codex thread's local rollout, without starting a turn. It is archived under the project's ignored `.ai-office/results/<execution-id>.json` and a separate backup, with original SHA-256 `03ac437acdb891a5358d4f730b437ad6d81032cc2cc19381f9dc0367064b5701`. Its project, workspace, agent, task, execution and thread identities are recorded. The earlier recovery note contained only 5,000 characters, so that truncated note was not treated as the complete answer.

## Preserve before validating

The real orchestrator now archives observed full non-planning responses before result validation. `ResultArchive` uses fixed project-owned paths, canonical boundary checks, a 128,000-character bound, secret filtering, SHA-256 checks and immutable existing-response validation. It never reads an arbitrary path supplied over HTTP. Aggregate-size and duplicate-path failures now produce distinct diagnostics with actual counts.

## Optional formatting-only recovery

`repair_proposal` requires a paused workflow, an inactive employee set, a failed patch-limit task and its owned complete archive. It does not start Codex. The existing TypeScript compiler package is loaded only for recovery; no dependency is installed.

The formatter parses TypeScript/TSX and removes indentation only from entirely whitespace trivia gaps between parsed leaf tokens, retaining every newline. JSX text is protected using its full span. Strings, templates, regular expressions, comments and token text remain unchanged. The result is reparsed and token kind/text pairs must match exactly; the original and corrected text must also match after removing spaces/tabs. A changed token, literal, JSX text, comment or line break causes rejection. CSS is left untouched. Per-file, total, duplicate and write-scope limits remain unchanged; formatting is refused if it cannot satisfy them.

For ARMGARAGE, only `src/App.tsx` needs formatting: 370 indentation characters are removed, reducing its proposed content to 7,779 characters and the total to **23,683**. `src/styles.css` and `tests/App.test.tsx`, their original hashes, paths and all other response fields remain unchanged. The unmodified original answer is retained alongside the corrected proposal in `WorkflowTask.proposalRecovery` and in the immutable archive.

The broker verifies current original file contents before preparing one exact three-file approval. An unsuccessful preview rolls back the live task change. No application, permission grant or test execution is automatic. The original execution ID and attempt count remain; the same integration task awaits Director approval instead of running Frontend again. QA still depends on applying that integration, and still requires its own explicit test approval.

The phase display also recognizes an explicitly prepared same-scope context continuation, so its historical input-blocked predecessor does not keep reporting `CHANGES_REQUIRED` after the continuation is ready. This changes no dependency or gate success rule.

## Validation

- 113 targeted tests passed covering proposal repair, context inputs, workflows, orchestrator, permissions, file actions, HTTP and resource policies. A final 31-test run covered formatting recovery, context phase display and team workflow after the final phase adjustment.
- New tests exercise complete archival before rejection, formatting-only recovery, JSX/string/template/regex/comment/newline preservation, duplicate/foreign/oversize/syntax failures, immutable archive ownership, altered metadata and stale-preview rollback.
- Production TypeScript/Vite build passed.
- A fresh Mock browser verified the original answer/hash, corrected three-file preview, one pending confirmation, paused workflow, unstarted QA and reload persistence with eight employees and no page errors. No confirmation was clicked. See `PROPOSAL_RECOVERY_BROWSER_EVIDENCE.json`.

No ARMGARAGE file was reapplied, no QA command ran and no Codex task was started by this repair.
