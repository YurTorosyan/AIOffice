# Independent gate finding references

QA could reject an integrated browser contract while citing both the integrator's files and approved upstream component inputs. The validator incorrectly required every cited file to belong to the named implementation owner's write scope, rejecting the completed QA report itself.

Independent QA, Security, SEO, Review and integration gates may now cite approved dependency inputs when:

- the named owner is a completed upstream implementation in both the verified and supplied handoffs;
- at least one cited file belongs to that owner's scope;
- every additional file is a required applied dependency file in both the recomputed and supplied version 2 read context.

Unknown owners, unrelated implementations, foreign files, planned but unapplied files, forged supplied context and legacy context do not gain this exception. Finding references grant no write permissions. Corrective tasks retain the named owner's original scope.

The existing `revalidate_result` command processes a saved completed execution without a new model turn. After successful validation it clears only the matching stale workflow rejection. A saved FAIL remains FAIL and a paused workflow remains paused.

## Verification

50 related tests passed, including independent-gate reference boundaries, permissions, task inputs, handoffs and same-execution revalidation. Production TypeScript/Vite build passed.

The original archived ARMGARAGE QA response passed a pure validation against a cloned current workflow. Its response hash and finding were preserved. Trusted receipts remained unit tests PASS, build PASS, browser contract FAIL. Nine current source/test files were hashed and workflow/checkpoint/permission backups were saved under ignored `work/qa-finding-recovery/`.

No ARMGARAGE tests, model turns or file applications were repeated. Live recovery is pending a bridge restart: automatic approval review rejected the attempted process stop. Do not mark the live QA task recovered until the restarted bridge accepts `revalidate_result` and its paused state, original response reference, receipts and approvals have been checked.
