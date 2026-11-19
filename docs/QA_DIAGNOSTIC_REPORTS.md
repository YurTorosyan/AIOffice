# Complete QA diagnostics and implementation handoff

## Problem

The web executor retained only the last 5,000 characters of a check's combined output. A long ARMGARAGE assertion included a DOM snapshot whose tail displaced the failure header and stack. The QA task correctly failed; the subsequent implementation correction received insufficient diagnostic evidence and returned BLOCKED.

## Storage and transfer

Web checks now archive their complete **sanitized captured output** in immutable project-owned `.ai-office/qa-reports/qa-<content-binding-hash>.json` files before returning their receipts. Each artifact binds project/workspace, workflow, producing QA task, approved operation, command, mode, source revision, exit code and status. Receipts carry a validated hash/length/completeness reference; their display output stays within 5,000 characters, preserving the beginning and end and labelling longer output as a preview.

The existing isolated process capture remains bounded (100,000 output bytes for browser/unit modes). Timeout/output-limit captures are explicitly incomplete and cannot become passing checks or complete failure diagnostics. Artifact text is limited to 128,000 characters. Persistence failure returns BLOCKED rather than claiming complete diagnostics.

The execution port supplies full report JSON as separate hashed `project/qa-reports/<id>.json` snapshots alongside the complete task contract and upstream handoffs. The bridge verifies artifact integrity, ownership, source command/revision, result/exit code and a matching committed runner receipt in the operation journal. Every supplied reference is checked, including duplicate IDs with conflicting ownership. Multiple full reports have a 200,000-character aggregate snapshot budget; overflow blocks submission instead of silently truncating. Reference fields remain intact in short prompt previews, and the prompt explicitly instructs employees to inspect the complete snapshots.

Corrective implementation preflight refuses a failed browser receipt without a complete diagnostic artifact. The guard runs before persisting an execution intent and again before submitting work. Legacy receipts remain readable but are not misrepresented as complete reports. No write scopes, approval rules, pinned images, browser assertions or office UI were changed.

## Current ARMGARAGE preservation and remaining gap

The existing completed Frontend BLOCKED response and its immutable archive reference are preserved. Existing QA receipts, approved applications and task results are unchanged. Nine ready source/test file hashes still match the preserved baseline. The workflow was paused with no active employee; no model turn, project test or file application was started.

The historical browser container was removed and the committed operation contains only the same 5,000-character tail. This patch cannot reconstruct the lost header or stack and does not invent either. Loading this server patch requires a bridge restart. Continuing the existing correction then requires separately approved acquisition of fresh browser diagnostics; a new diagnostic artifact must be attached through a newly recorded receipt, never by rewriting the old completed QA receipt or Frontend response. No such acquisition or model continuation was authorized or performed here.

## Verification

74 related tests passed across report persistence/transfer, web and ARMGARAGE executor fixtures, permissions, task inputs, handoffs, workflow recovery and stabilization contracts. The report tests include reload, long assertion/stack retention, redaction, wrong owner/reference, corrupted content, incomplete capture, archive failure, committed receipt binding and complete Frontend snapshot transfer. Production TypeScript/Vite build passed. The final duplicate-reference check was covered by a focused rerun. All checks used AI Office fixtures; ARMGARAGE QA/browser execution was not repeated. No UI changed, so no additional UI browser check was run.
