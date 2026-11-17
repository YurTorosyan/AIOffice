# Isolated React QA and workspace relocation

Coffee House is now located at **C:\Projects\Sample** under the same project ID, `19afa022-a796-464a-aba8-9f532e360094`. The four previously applied source/test files retain their original SHA-256 values. Their application receipt remains approved exactly once. No implementation was replayed and no real Codex model task was launched during this work.

## Fixed web QA profile

`web_checks` is a QA-only, exact-test-file permission profile. It provides three independently reported checks:

1. Vitest with React Testing Library/jsdom for `.test.tsx`, and a separate Node environment for source/CSS contract `.test.ts` tests.
2. TypeScript checking and a production Vite build using trusted React configuration.
3. A separate sandboxed Chromium container receiving only the production assets. Its Coffee House acceptance contract checks the heading, four named drinks, semantic sections/navigation, desktop (1440px), mobile (390px), overflow and page/console errors. Screenshot hashes are retained in output. This is not a comprehensive accessibility or visual-regression audit.

The profile supports the pinned Coffee House dependency set; unknown projects/dependency versions fail closed. It does not execute arbitrary package scripts or project-provided Vite plugins. The project manifest, lockfile, entry point, test setup and configuration are explicit baseline snapshots, hashed together with scoped source/tests, the pinned image and seccomp policy. A change invalidates subsequent gate evidence. Build results and all three receipts are retained in the QA task and handoff prompts; later Security/Reviewer/Lead tasks receive them without truncating away build/browser results.

## Isolation and provenance

All execution uses the fixed local Docker Linux engine, with no host mounts, socket, inherited credentials, network or published ports. Each disposable container runs UID/GID 1000, with a read-only root, dropped capabilities, no new privileges, private IPC and bounded CPU/memory/pids/output/time/tmpfs. Missing isolation, timeouts, oversized output and unconfirmed cleanup remain `BLOCKED`, never `PASS`.

Chromium's own sandbox is enabled. The seccomp profile derives from [Playwright v1.65.1](https://github.com/microsoft/playwright/blob/v1.65.1/utils/docker/seccomp_profile.json), following the [official container guidance](https://playwright.dev/docs/docker). It additionally permits `chroot` for Chromium's unprivileged user-namespace sandbox while retaining all outer capability drops. The exact local policy hash is checked before every run. The real self-check verifies non-root identity, no effective capabilities, no privilege elevation, read-only image, absent host socket/environment, blocked egress and a working sandboxed browser.

Project code is provided as validated stdin snapshots; runtime containers never install dependencies. The image has pinned registry packages and lockfile integrity values; its Node base is digest-pinned and runtime execution uses the exact built image ID in `server/qa-web-image.json`. Build artifact bytes are transferred internally without applying log redaction (which corrupts JavaScript); textual receipts remain redacted. Browser containers never receive project test/config code.

To rebuild the trusted local image after an intentional profile update:

```powershell
docker --host npipe:////./pipe/dockerDesktopLinuxEngine build --pull=false -t ai-office-web-qa:verified-v1 server/qa-web-image
docker --host npipe:////./pipe/dockerDesktopLinuxEngine image inspect ai-office-web-qa:verified-v1 --format '{{.Id}}'
```

Update the exact image ID only after inspecting the build, then re-run isolation verification. Bridge startup never pulls/builds images automatically.

## Workflow behavior

An existing denied/expired QA request is renewed with the new three-command plan and a fresh expiring permission request. It still needs Director confirmation. Applying that QA action runs only disposable snapshots and saves three attributable `runner` receipts; it never reapplies implementation files. The workflow may remain paused while verification is approved and performed.

An old Security/Reviewer/Lead result that is `BLOCKED` solely awaiting evidence is preserved. With fresh approved passing receipts and no recorded findings, an explicit `recheck_gate` action can queue a bounded new review dependent on QA and the original gate. It cannot mark the old result passing or waive findings. New model execution still requires explicit workflow resume. The UI shows all QA receipts and the recheck action.

## Relocation safety

Director explicitly requested relocation into the existing Sample directory. The startup migration ran only under the exclusive bridge writer lock. It checked root identities, target collisions and a source inventory before moving the selected Coffee House roots: package/lock/config/entry files, src, tests, test-support, node_modules and its local `.ai-office` artifacts. MASIX and pre-existing Sample images were untouched. No recursive parent-directory move or deletion was used.

Project ID, task/result/execution IDs, handoffs and approval history are retained. Only structured workspace metadata and directory identities are rebound. Original project/workflow/checkpoint/permission files remain in `relocation-7d9559d9-06ed-4c02-a41d-446fe3de1752` under the project's existing service state directory. Outstanding grants are expired on relocation. A journal supports restart after partial moves; changed bytes or target collisions stop the migration.

## Verification

- 234 Node tests and 6 Python tests passed, including profile restrictions, TSX scoping, failure/timeout/cleanup behavior, migration collisions/identity/retention, and all three receipts reaching prompts.
- AI Office production build passed.
- The real isolated Coffee House run passed 7 Vitest tests, production typecheck/build, and both Chromium viewports. See [real execution evidence](WEB_QA_REAL_EVIDENCE.json).
- A fresh Mock browser verified eight employees, visible Vitest/build/browser receipts, original `BLOCKED` history, and a pending recheck without implementation replay or automatic approval. See [UI evidence](WEB_QA_BROWSER_EVIDENCE.json).
- Post-restart live checks confirmed the Sample workspace, unchanged source hashes, one application receipt, no recovery errors for all eight employees, a verified web executor, and a paused workflow with the exact QA request awaiting confirmation.
