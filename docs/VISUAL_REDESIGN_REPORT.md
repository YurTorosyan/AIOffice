# QST AI Office — visual redesign

Implemented 2026-11-15. Scope: presentation only, following the supplied reference and the Director's explicit instruction to leave functionality unchanged.

## Visual result

- Dark navy interface, orange QST branding, cyan technical accents and readable status colors.
- Native SVG office: two rows of four desks, distinct animal portraits, monitors, plants, pendant lights, coffee corner, orange sofa, sleeping mascot, beanbag and decorative hologram.
- Armenian panorama drawn as a single clipped SVG scene: distant snow-covered Greater and Lesser Ararat; pink tuff city blocks with stylized Opera, Cascade and Republic Square tower; Mother Armenia with a horizontal sword on an elevated Victory Park hill. This is an artistic composition, not a geographically surveyed view from a particular building.
- Reference is stored under design-reference for comparison; it is not a rendered background or application asset.
- Employee panel has Task / Activity / Stats views and actual assigned Skill names. Full existing Skill metadata remains in the expandable Agent Skills section.
- Existing Task Panel and checkpoints are accessible below the scene. Actual events appear in Team Activity. Project metrics remain available under Stats.
- Clock shows Yerevan time. Day/night and reduced-motion controls affect presentation only. Notifications display existing error events. There is one existing project; no additional project switching behavior was introduced.
- Narrow screens retain all controls; the scene scrolls horizontally and employee details move below it. Keyboard selection and reduced-motion preferences remain supported.

Landmark references consulted: [Visit Yerevan](https://www.visityerevan.am/places/details/116/en/) and [Armenian Cultural Heritage Research Center](https://armheritage.am/en/2869/), describing Mother Armenia in Victory Park, its sword and pedestal.

## Preservation of functionality

Reused the existing useOffice hook, TaskPanel, CheckpointPanel, RuntimePanel, AgentSkills, presentation mapping and metrics. Office/Character retain their selection and state inputs and animation classes. Employee IDs, names, roles, Skills and task relationships are unchanged.

No changes to domain models, state, task/event systems, registry, adapters, server, runtime configuration, persistence or checkpoint/resume implementation. No dependency changes. All additions of state in App are presentation choices (tabs/theme/motion) and the clock.

## Verification already completed

- Four new visual tests pass: eight named accessible employees with one selection; click/Enter/Space selection without state mutation; native SVG Armenian landmarks without a raster backdrop; all status animation hooks and safely escaped task labels.
- Latest full Node run: 79/80 passed. The remaining failure was the existing atomic checkpoint persistence test (manual_checkpoint versus user_pause). An isolated diagnostic copy subsequently passed; a direct 12-write persistence diagnostic also passed. No runtime or existing test was changed to hide this intermittent storage failure. The full suite was not repeated after the Director requested an end to checks of untouched functionality.
- Python manifest/profile validation passed; all 12 pinned community Skills verified. The Python unittest phase of the latest npm test was not reached because it follows Node success with &&.
- Production build passed: 38 modules; JS 296.94 kB (gzip 89.51 kB), CSS 22.23 kB (gzip 5.81 kB).
- Browser: all eight employee selections; Task/Activity/Stats; mock workflow completed 8/8 at 100%; task creation, Frontend assignment, in_progress and 25%; pause/checkpoint and resume retaining 25%.
- Browser at 390 x 844: document width 375, eight workstation controls retained; desktop composition captured at 1672 x 1000.
- Existing real bridge on 127.0.0.1:8787: connected successfully to codex-cli 0.144.5, three Lead Skills discovered, then disconnected normally. No new real assignment launched; other seven employees were not connected.

Evidence: redesign-desktop.jpg, redesign-mobile.jpg, redesign-codex-connected.jpg. Browser saved as a deliverable. Waiting for Director's visual approval; no further stage started.

## Files

Application: src/ui/App.tsx, src/ui/Office.tsx, src/ui/style.css.
Tests: tests/visual.test.ts.
Documentation: this report, the supplied reference PNG and three browser captures.
