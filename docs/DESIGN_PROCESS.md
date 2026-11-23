# Design approval gates — deployment scope

This delivery adds versioned concept selection before UI implementation and a separate visual-acceptance gate. Existing workflows without `design` remain compatible. New UI workflows require a concept; only Director decisions change approval state. Concepts are immutable PNG artifacts with content hashes and project/workflow binding. Repeated requests are idempotent. Changed concept packages require a new revision. Final acceptance binds a specific visual evidence ID and current implementation revision.

The UI supports two concept cards, desktop/mobile previews, feedback and a separate acceptance control. Actual production capture uses the archived build, fixed isolated Chromium, three viewports and cached request receipts. It does not re-run Vitest/build. Captured images are stored as viewable PNGs. A read-only Designer task compares captured screens with the approved concept before final Director acceptance. Arbitrary uploaded screenshots cannot masquerade as implementation captures.

Native image inputs use `localImage` from the installed Codex protocol, with project-local path and SHA-256 checks. No employee receives new shell/network/write permissions. PyYAML validation tooling is installed project-locally with:

    python -m pip install --target work/validation-deps-current "PyYAML>=6,<7"

## Verified

- Full suite: 348 Node tests and 6 Python tests passed after the PyYAML repair.
- Additional focused design, admission, report and workflow tests cover subsequent changes.
- Production build passed.
- Isolated browser check: actual React design card at 390/1440, real PNG decode, choices, keyboard focus, no overflow. This is a component browser check, not a claim that the full application was interactively accepted in Chrome.
- Original ARMGARAGE workflow and 18 ready project files retained unchanged.
- One separate read-only hero workflow runs only UI/UX Designer. No Lead/Frontend/QA execution was created for this task.

## Frontend pilot and automatic concept renderer

New team UI plans include two read-only Designer draft tasks and one separate Frontend presentation pilot. The producer returns bounded HTML/CSS plus registered image IDs, not executable source or arbitrary commands. The exact `design.render` approval binds project, workflow, task/execution, draft, assets and concept revision. After confirmation, a pinned, non-root, read-only, networkless Chromium container with JavaScript disabled captures 390/768/1440. Drafts never run inline in the office. The broker stores immutable request/receipt data and PNGs; replay returns the existing result. A crash or unknown outcome blocks automatic replay. Partial render output never becomes a concept package.

Two actual concept renders form the Director selection package automatically. Imported verified PNGs remain supported. The selected concept gates the designated pilot; other frontend/UI write tasks and their apply broker remain blocked until pilot review passes. Backend work outside UI remains independent. QA/Security/Review do not acquire new permissions. A Designer task receives the selected board and actual pilot screenshots through hash-verified native image inputs. Review PASS permits subsequent UI work; the current ARMGARAGE pilot additionally requires Director approval, as explicitly requested. Small pilot corrections preserve concept approval and original responses, with at most two corrective rounds. Final production visual acceptance remains a separate gate tied to a real archived build.

The presentation pilot is static HTML/CSS and one supporting section. It is not a replacement React application or proof that product interactions work. Production implementation still uses the existing proposal/apply/test workflow. The separate preview disables scripts, external resources and form submission. A local immutable receipt retains the full draft and registered asset bindings.

## Verification of this extension

- Full suite: 354 Node tests and 6 Python tests passed before final focused fixes.
- Final focused workflow/admission/security/output/design regression set: 78 passing tests. Response-resume ownership and durability checks: 26 passing tests.
- Real isolated concept-render smoke: 390/768/1440 PNGs produced by Chromium.
- Real separate Frontend hero pilot: actual HTML/CSS rendered at all three viewports.
- Actual React pilot-card component browser check: 390/1440, PNG decode, approval controls, keyboard focus, no horizontal overflow. This is a component check, not a claim of full interactive application acceptance.
- The original 18 ARMGARAGE files and completed workflow were compared byte-for-byte / structurally with the baseline and retained.

## Current ARMGARAGE pilot

Workflow: `armgarage-hero-design-20261123`. The existing Designer handoff is preserved. Director chose `cinematic-a`; one read-only Frontend task produced the standalone pilot. No source patches were proposed or applied. The native Designer confirmed `matches_concept`; the pilot remains paused for Director approval. One interrupted review continued from its original thread with a bounded review schema. A legacy default-sink owner mismatch was recovered only after checking the completed runtime task, checkpoint, original thread/turn and response SHA-256; the original immutable archive remains, and the derived record carries provenance. Resume now re-registers the graph-owned output sink before submitting a continuation. No Frontend or render replay occurred. Exact artifact identities, native Frontend result and render receipts are in the private project journal and `work/design-process-spec/`.

Standalone preview export: `C:/Projects/ArmGarageHeroPilot/concept-a-v1/`. Original site: `C:/Projects/ArmGarage/`. They are separate. The generated workshop image is illustrative, not a photograph of the actual business. Calculator/service links remain integration placeholders. No production hero replacement is authorized by concept selection alone.

## Remaining broader specification limitations

First-class brief/reference/license manifests and complete Mock UI artifact transport remain outside this extension. Mock produces explicitly labelled synthetic drafts; it does not claim real renders or native model work. The generated references were prepared by the host. Do not describe every D01–D22 scenario or the entire broader specification as independently accepted.
