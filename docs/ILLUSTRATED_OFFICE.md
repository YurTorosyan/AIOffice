# Illustrated QST office artwork

Implemented 2026-11-15 following the Director-approved dashboard concept and Lead Developer workstation sample. This replaces schematic scene graphics with generated raster illustrations while retaining the existing SVG scene container and React selection/state inputs.

## Assets and composition

- `public/art/room.svg`: original illustrated room (1586 x 992), including the continuous Yerevan/Ararat/Mother Armenia panorama, lighting, wood floor, coffee corner and lounge. No desks or employees are baked into this background. The sleeping fox is a decorative pet, not an employee.
- `public/art/workstation.svg`: transparent empty workstation (1254 x 1254). Reused consistently across eight desks. Foreground clipping places the desktop and monitors in front of each separate character.
- `public/art/employees.svg`: transparent 1536 x 1024 atlas, four columns by two rows, 384 x 512 cells. Fixed visual mapping: lead/wolf, design/fox, frontend/cat, backend/raccoon, seo/squirrel, security/owl, qa/badger, review/goat.
- `public/art/manifest.json`: original PNG dimensions, sizes and SHA-256 hashes. SVG files are self-contained transport wrappers embedding those PNG bytes; they are not primitive vector illustrations. This uses the existing bridge's supported SVG media type without any change to its server or security configuration.
- Portraits use the same atlas cells as their corresponding workers. Names, roles, status colors, progress and task titles remain live application data, not painted text. Workstations have explicit bounded selection targets, separate from the artwork's geometry.

The artwork is original built-in image generation guided by the two user-approved images. It does not introduce a third-party code or asset package. No stock-asset license claim is made. The supplied reference was used as authorized visual guidance.

## Production prompt set

1. ROOM: richly detailed high-definition pixel art matching the approved dashboard and Lead sample; warm textured oak and navy/amber lighting; coherent afternoon Yerevan, distant twin-peaked Ararat, Opera/Cascade and sword-bearing Mother Armenia above Victory Park; central QST branding; side plants, lamps and coffee corner; bottom lounge with orange sofa, sleeping fox and navy beanbag, small hologram counter. Keep the center floor empty for two rows of four separately rendered workstations. No employees, workstation desks, monitors, UI or role labels in the background.
2. WORKSTATION: one transparent empty workstation matching the approved Lead desk; thick honey-oak desktop, dark steel legs, brass fittings, right drawer pedestal, left tower, empty upholstered chair, two angled monitors with a central character gap, keyboard, mouse, mug, notebook and small plant. Blank front nameplate, no character, no environment, no baked status. Detailed pixel textures, warm upper-left light, cyan screen bounce.
3. EMPLOYEE ATLAS: exactly eight unique transparent seated upper-body characters in a strict four-by-two equal-cell grid, ordered by the unchanged employee IDs above. Approved wolf in navy QST hoodie; fox with glasses and waistcoat; headphone-wearing ginger cat; charcoal-hoodie raccoon; olive-jacket squirrel; bespectacled owl; black/white badger; tan horned goat with waistcoat. Consistent camera, scale, expressive eyes, detailed fur/feathers and clothing, neutral attentive pose, both paws forward. No desks, monitors, chairs, labels or UI.

These production briefs accompanied the approved dashboard and Lead sample as visual references in the built-in image tool. Originals are embedded losslessly in the project wrappers, not referenced from a user-specific external path.

## Animation and scope

The atlas contains eight neutral character paintings, not eight complete pose-by-pose animation sheets. Animation retains the existing lightweight approach: breathing, clipped paw movement for Working/Testing, thinking motion, short completed/error reactions and live state bubbles. Existing pause and reduced-motion settings stop the appropriate motion. No animation implies a runtime is connected: state is supplied by the existing adapter.

Only `src/ui/Office.tsx`, presentation CSS, the corresponding visual tests and artwork/documentation were changed. App controls, employee identities, task/event logic, registry, Skills, useOffice, adapters, checkpoint storage, backend and Codex configuration were not modified. No new dependencies.

## Focused verification

- Five visual tests passed: eight selectable employees; click/Enter/Space semantics; local self-contained illustrated assets and Armenian landmark labels; status animation hooks and escaped task labels; distinct stable portrait atlas cells.
- Production build passed: 38 modules, JS 281.26 kB (gzip 83.81 kB), CSS 24.35 kB (gzip 6.26 kB). Illustrated assets are separate reusable resources, approximately 9.2 MiB uncompressed including base64 wrappers.
- Browser on the existing bridge at 127.0.0.1:8787: all images loaded, eight correct employee/portrait selections, no console warnings/errors observed. The explicit selection-target fix was checked after the last build.
- Responsive 390 x 844: document width 375; eight employee targets retained; Enter selected QA Engineer and portrait cell 6 correctly.
- Evidence: `illustrated-office-desktop.jpg`, `illustrated-office-mobile.jpg`.
- Per the Director's instruction, unchanged runtime/domain suites were not rerun and no new real Codex task or connection was started. Existing mock recovery data was left intact.
