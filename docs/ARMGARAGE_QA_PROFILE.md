# ARMGARAGE QA profile

## Registration and implementation brief

- Registered workspace: **C:\Projects\ArmGarage**, project ID `67476ea3-b315-4ff9-a043-bb110a2f22e1`.
- Package name: **`armgarage`**; profile: **`armgarage-react-v1`**; QA-only permission: **`armgarage_checks`**.
- [Full English specification](ARMGARAGE_SPEC_EN.md) is also installed as the project's **README.md**, which the bridge attaches to employee context.
- [Short English launch prompt](ARMGARAGE_TASK_EN.txt) is also installed as **TASK_EN.txt**. Paste that prompt into the existing 2,000-character task field; the complete specification stays in README.md. Do not paste the entire specification into the limited task field.

Only bootstrap/configuration/specification files have been prepared in the workspace: package manifest and lockfile, index.html, src/main.tsx, tsconfig, Vite/Vitest config, test-support/setup.ts, README, task prompt and gitignore. No application page, catalogue implementation or booking UI has been generated. No real Codex task was started. Host dependencies can be installed using the pinned lockfile when local development is needed; isolated QA uses the image's pinned dependencies without a host node_modules mount.

## What the profile checks

The three attributed receipts remain separate: Vitest, TypeScript/Vite production build, and sandboxed Chromium acceptance. All are tied to the scoped source/tests, baseline setup/manifest/lockfile, exact image and seccomp identity. A profile or input change invalidates old evidence.

The browser contract runs at **390, 768 and 1440 px**, with a fresh context per viewport and reduced motion. It checks the fixed eight-service catalogue and prices, combined search/category filters, numeric ascending/descending sorting, empty/reset states, service details, mobile menu, dialog semantics/focus trapping/restoration, calculator reset/deduplication/vehicle factors/urgency/duration, estimate-to-booking transfer, required-field errors and their accessible associations, phone rejection, past dates, preserved form data and honest demo confirmation.

The browser denies outgoing submissions and unregistered resource requests, checks personal data is absent from storage/cookies/URLs/console, and rejects page/console errors and horizontal overflow. It accepts only served build assets or embedded image data; no user browser profile or real service endpoint is used. These checks are not a comprehensive accessibility, visual-regression, cross-browser or security audit.

**17 trusted domain tests** are installed read-only in the image. They require the explicit `src/domain/garage.ts` API documented in the English brief, independently checking all catalogue values, filtering/sorting, zero/deduplicated estimates, every vehicle/urgency combination, fractional final rounding, invalid prices/IDs/vehicles, Armenian telephone normalization, required fields, valid/same-day/past/non-calendar dates, time/service validation, comment length and input immutability. They run in addition to the team's own source tests and cannot be removed by an employee proposal. Approval commands explicitly list the trusted test file.

## Isolation and Coffee House preservation

ARMGARAGE uses its own Dockerfile, browser contract, trusted tests and immutable image reference in `server/qa-armgarage-image.json`. It reuses pinned tool versions and trusted execution mechanics, but never changes `server/qa-web-image.json`, Coffee House's runner or its image. Registration is selected from the canonical project's manifest; an ARMGARAGE snapshot cannot run through the Coffee House acceptance profile. Unknown/missing registrations and unsupported dependency versions fail closed.

Containers remain non-root, read-only, networkless, mountless, capability-free and resource-bounded, with Chromium sandbox and checked seccomp policy. Runtime never downloads dependencies or executes arbitrary package scripts/plugins. Exact approvals and project/task/role boundaries remain required. Existing workflow, source-file and patch-size limits are unchanged; Lead must report conflicts instead of silently discarding requirements. The snapshot profile currently supports text source and HTML/JS/CSS/SVG build artifacts; extra binary assets/dependencies require an explicitly approved extension.

Before implementation, Coffee House's source/config files, original image/runner/Dockerfile and verification revision were recorded. They were compared after setup and remained unchanged. Coffee House's project tests were not run and no project or workflow was switched by this setup.

## Harness validation

[Evidence](ARMGARAGE_QA_EVIDENCE.json) is explicitly labelled **synthetic QA-harness validation**, not a passing result for an implemented ARMGARAGE website. A deliberately plain technical fixture exercises the entire UI contract. Injected defects must produce an actual failing exit code and the expected assertion, not an infrastructure timeout: broken filtering, incorrect totals, past-date acceptance, personal-data storage, outgoing submission and a false real-booking confirmation. Separate domain mutations cover truncating rounding, lexical price sorting, accepting letters in telephone numbers and past-date acceptance.

The pipeline fixture additionally verifies that actual isolated Vitest/trusted-domain, production build and browser results return as three runner receipts. No fixture is installed into the user's project and no live workflow is given synthetic receipts.

Validation commands (from AI Office):

```powershell
node --experimental-strip-types scripts/verify-armgarage-profile.mjs
node --experimental-strip-types scripts/verify-armgarage-pipeline.mjs
```

To intentionally rebuild only the ARMGARAGE image:

```powershell
docker --host npipe:////./pipe/dockerDesktopLinuxEngine build --pull=false -t ai-office-armgarage-qa:verified-v1 -f server/qa-armgarage-image/Dockerfile server
docker --host npipe:////./pipe/dockerDesktopLinuxEngine image inspect ai-office-armgarage-qa:verified-v1 --format '{{.Id}}'
```

Update only the ARMGARAGE image reference after inspecting and verifying the build. Runtime never builds/pulls it automatically. Reload the bridge once to load this new registration; verify `executors.qaTests.armgarage.available` in the security snapshot. Starting implementation and confirming future QA operations remain separate Director actions.
