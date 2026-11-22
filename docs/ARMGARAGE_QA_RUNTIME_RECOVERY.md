# ARMGARAGE QA runtime recovery

This repair changes AI Office's isolated ARMGARAGE runner, not the website.
The workflow remains paused. No project tests, file applications, or Codex jobs
are executed by preparing this recovery.

## Evidence and limits

The original `gate-qa-3` receipts are preserved: Vitest exited 143; production
build passed; Chromium completed the 390px journey, then closed during a
subsequent screenshot. Neither the interrupted tests nor partial browser run
prove full acceptance. Security and QA returned BLOCKED without source findings.

The previous ARMGARAGE Vitest path delegated to the Coffee House legacy runner,
whose nested `spawnSync` has a fixed 45-second timeout. This internal deadline
could terminate the suite before the outer 90-second container deadline. Its
termination was reported as a test failure rather than infrastructure failure.
The new ARMGARAGE Vitest path runs independently with a fixed 120-second limit,
bounded output and explicit timeout/signal diagnostics. Real assertion failures
remain FAIL; infrastructure termination is BLOCKED. Coffee House retains its
original runner, image and timeouts.

The old Chromium output lacks a reliable exit reason or cgroup measurements, so
it does not establish OOM, an application defect, or a particular Chromium bug.
The recovery releases the entire browser and its profile between viewports,
provides a writable fontconfig cache under `/tmp`, and records the active stage,
viewport, memory counters and OOM events. Screenshots and all original acceptance
assertions remain mandatory. A closed browser cannot count as a passed viewport.
An independent 180-second browser deadline fits inside a 200-second container
deadline. There are no automatic retries or relaxed sandbox permissions.

## Verification of the runner

Host regression tests cover bounded process completion, failure, timeout,
termination and output overflow; browser lifecycle; separate profile timeouts;
real assertion failures versus infrastructure termination; existing report
integrity and permission boundaries. Docker fixtures use synthetic data only:
an actual Vitest test deliberately exceeds the former 45-second limit, and the
unchanged browser acceptance contract exercises 390/768/1440px.

Local evidence and the pinned candidate image are recorded under
`work/qa-runtime-repair/`. These fixtures do not certify the actual ARMGARAGE site.

## Exact repeat proposed for Director approval

Project: `67476ea3-b315-4ff9-a043-bb110a2f22e1`, `C:\Projects\ArmGarage`.
Workflow: `cf87600a-5cfd-46b3-8bb1-fe506684b2f9`.
The unexecuted request is `work/qa-runtime-repair/repeat-request.json`.

1. Vitest with the trusted React/jsdom configuration:
   `tests/garage.test.ts`, `tests/App.test.tsx`, `tests/BookingDialog.test.tsx`,
   and immutable `/opt/qa/armgarage-domain.test.mjs`.
2. TypeScript and Vite build under the trusted configuration, solely to produce
   the assets consumed by the new browser run. The prior successful build receipt
   remains historical evidence; its assets were not persisted by the old runner.
3. Sandboxed Chromium at 390/768/1440px: filtering, service details, keyboard and
   focus, calculator arithmetic and transfer, booking validation, demonstration
   confirmation, overflow, network, console and storage privacy checks.

Before execution, compare every project source/test hash with the preserved
manifest. Any change requires a fresh review. Execute once under a new operation
ID and explicit exact-command approval; archive full reports and preserve every
old result. Do not reuse the consumed previous approval or apply any source file.
No Codex work, automatic team resume, corrective cycle increase or reclassification
of old receipts is authorized by this preparation.

## Follow-up: screenshot file limit reproduced (2026-11-22)

The approved single repeat passed all 69 Vitest tests and the production build.
The browser completed the 390px journey and all 768px functional assertions,
then closed on the 768px full-page screenshot. New telemetry showed no page
errors, no cgroup OOM events and peak memory of approximately 303 MB.

An independent synthetic 768×9016 page reproduced the same screenshot crash with
`RLIMIT_FSIZE=16 MiB` and succeeded with `128 MiB` (compressed PNG: 115876 bytes).
Large file-backed screenshot buffers require more space than the final PNG.
Only ARMGARAGE browser containers now use the bounded 128 MiB file limit;
other modes and Coffee House retain 16 MiB. Memory, network, privilege, sandbox
and filesystem restrictions remain unchanged. Evidence is under
`work/qa-runtime-repair/screenshot-limit-{16777216,134217728}.json`.

The repeat saved validated production assets and their original build digest.
A further approved browser-only operation can consume these exact assets after
checking source hashes, image, build receipt and asset digest. It must preserve
the successful Vitest/build receipts and the blocked browser report, not run
Vitest/build again, and not silently substitute a PASS for the old operation.

If the approved repeat passes, prepare a separate QA evidence continuation and
Security reassessment using fresh receipts, preserving the previous BLOCKED
responses. Only then can the pending Reviewer and final Lead continue. This is
an evidence recovery, not another implementation cycle. A new source finding
requires its own reviewed proposal.
