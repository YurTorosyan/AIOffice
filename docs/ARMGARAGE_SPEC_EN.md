# ARMGARAGE — Product Specification and QA Contract

## Objective and boundaries

Build a polished, responsive website for **ARMGARAGE**, a fictional automotive service centre in Yerevan, Armenia. This is a complete interactive frontend assignment, not a static collection of cards. Customers must be able to find services, obtain an itemised estimate and compose a clearly labelled demonstration booking request.

Workspace: **C:\Projects\ArmGarage**. Use the existing registered ArmGarage project. Do not modify Coffee House, its files, QA profile, results or workspace. Do not modify AI Office visuals, employee roles, Codex permissions or orchestration. Do not start real Codex tasks until the Director explicitly requests implementation.

This specification is in English; the customer-facing interface is **Russian**, with AMD prices. The registered package name is exactly **`armgarage`** and the acceptance profile is **`armgarage-react-v1`**. Do not identify this project as `coffee-house` to bypass its QA contract.

## 1. Visual design

Create a professional automotive identity using graphite surfaces, light readable content panels and restrained orange/red accents. Use expressive typography, coherent spacing, clear hierarchy and polished hover/focus/selected/error/busy states. Use approved local automotive images or original local illustrations; no external image requests or fabricated certifications, awards, customer counts or guarantees. Do not reuse the Coffee House design.

Designer first supplies the visual specification, responsive layouts and interaction states. Design tasks are read-only handoffs; implementation files belong to Frontend. Avoid one oversized component. Report missing assets and infrastructure honestly instead of silently expanding permissions or installing packages.

## 2. Page content

- Header: ARMGARAGE identity, navigation to Services, Estimate, About, Reviews and Contacts; primary booking action; accessible mobile menu.
- Hero: a clear automotive value proposition, automotive visual, estimate and booking calls to action.
- Services: the eight demonstration services below, with descriptions, category, starting price and duration. Label prices as illustrative starting estimates.
- About: the service approach and the workflow Request → Diagnosis → Approval → Repair → Collection, plus an automotive/workshop gallery.
- Reviews: at least four **explicitly labelled demonstration reviews**, with working previous/next controls. Do not present them as verified customer feedback.
- Contacts: Yerevan, Armenia, with clearly marked placeholders for the actual street address, telephone and opening hours. Do not invent operational contact details. Every enabled button must have meaningful behaviour.

## 3. Versioned demonstration catalogue

| Stable ID | Category value | Russian display name | Starting price, AMD | Minutes |
| --- | --- | --- | ---: | ---: |
| computer-diagnostics | diagnostics | Компьютерная диагностика | 12000 | 45 |
| full-inspection | diagnostics | Комплексный осмотр | 25000 | 90 |
| oil-change | maintenance | Замена масла | 18000 | 60 |
| engine-service | maintenance | Обслуживание двигателя | 30000 | 120 |
| brake-service | brakes-suspension | Обслуживание тормозов | 22000 | 90 |
| suspension-check | brakes-suspension | Проверка подвески | 15000 | 60 |
| battery-check | electrical | Проверка аккумулятора | 8000 | 30 |
| electrical-diagnostics | electrical | Диагностика электрики | 20000 | 75 |

Keep this dataset separate from components. These are fictional acceptance values, not verified business prices. A later catalogue change requires an explicit acceptance-contract update.

## 4. Service discovery

Search names case-insensitively and ignore surrounding whitespace. Combine search and category filters using AND. Category options: `all`, `diagnostics`, `maintenance`, `brakes-suspension`, `electrical`. Sort options: `price-asc`, `price-desc`; prices sort numerically. Display the result count, a useful empty state and reset action. Reset clears the query/category/sort back to the complete catalogue, sorted by ascending price.

Each Details action opens an accessible service dialog. Show the correct service information and a booking action that preselects that service. Escape closes dialogs; focus stays inside an open dialog and returns to a meaningful visible trigger after closing. Do not leave stacked service/booking dialogs open.

## 5. Estimate calculator

Select unique services using checkboxes. Vehicle values and factors: `car` = 1; `crossover` = 1.15; `suv` = 1.3. Urgent service adds 20%.

`total = Math.round(sum(selected service prices) × vehicle factor × (urgent ? 1.2 : 1))`

Show an itemised breakdown, unadjusted subtotal, estimated duration as the sum of selected service minutes, and the integer AMD total. Update immediately when selections change. A service cannot be counted twice. With no services, show zero and a selection hint; booking from the calculator is disabled. Reset clears services/urgency and restores `car`.

The calculator booking action transfers all service IDs, vehicle type, urgency and the same estimate into the booking dialog. Display the Russian equivalent of: **“Preliminary estimate. The final price is determined after diagnosis.”** Do not imply guaranteed completion times or final prices.

Reference case: oil-change + brake-service → subtotal 40000, duration 150 minutes; crossover 46000; urgent crossover 55200; urgent SUV 62400; urgent car 48000. Unit tests must also exercise a fractional rounding case using a synthetic amount, duplicate IDs, zero selection and invalid inputs.

## 6. Demonstration booking

Required: name, telephone, make/model, at least one service, desired date, time interval and data-processing consent. Optional: comment (maximum 500 characters). Include vehicle and urgency controls and a recalculated booking estimate. Header booking starts with no services; service Details preselects that service; calculator booking transfers its complete estimate.

Accept Armenian local `0` + 8 digits and international `+374` + 8 digits, allowing spaces, parentheses and hyphens. Normalize valid phones to `+374XXXXXXXX`. Reject letters and invalid length; explain the format next to the field. Trim names; whitespace-only names and make/model values are invalid.

Dates before the customer's local current date are invalid. Future dates are accepted. Time intervals are illustrative selectable values (`09:00`, `11:00`, `14:00`, `16:00`), not verified availability. Use explicit inline errors, preserve entered data when validation fails, associate errors with their fields and prevent repeated submission while processing. Implement accessible custom validation (`noValidate` on the form), not browser-only popup validation.

No backend, real booking, analytics or outgoing submission is permitted. On success show a single Russian confirmation equivalent to: **“A demonstration request has been prepared. The data was not sent to the service centre and the appointment time is not confirmed.”** Include the selected services and estimate in the confirmation. Do not store personal data in localStorage, sessionStorage, cookies, console logs or URLs. Do not claim the slot has been reserved.

## 7. Responsive and accessibility requirements

Verify **390, 768 and 1440 px**. No horizontal page overflow. Mobile menu must open/close, expose `aria-expanded` and close using Escape. All controls must work by keyboard with visible focus and meaningful labels. Dialogs use `role="dialog"`, `aria-modal="true"`, an accessible name, focus trapping and focus restoration. Associate validation errors using `aria-invalid`/`aria-describedby`; announce errors/success. Honour `prefers-reduced-motion`. Provide image alt text and readable contrast.

## 8. Architecture, tooling and planning limits

Use the prepared React/TypeScript/Vite/Vitest infrastructure. Keep catalogue, estimate and validation logic independent of React. Unit tests must use Node for pure contracts and jsdom for DOM/TSX tests. No new dependencies, network, backend or permissions without explicit approval.

AI Office currently limits a workflow to eight scoped source/test files and an individual patch proposal to four files/24,000 characters total (12,000 per file). Lead must stage work within those limits or report the conflict before implementation; never silently drop requirements. One possible eight-file surface is App, ServiceCatalog, BookingDialog, garage domain, stylesheet and three test files. Bootstrap/config/test-support files are prepared outside those employee proposals. Do not rewrite them or the QA runner.

## 9. Stable QA hooks

The pure domain module **`src/domain/garage.ts`** is mandatory. Export `SERVICES` with the fields in the catalogue table, `filterServices(query, category='all', sort='price-asc', catalogue=SERVICES)`, `calculateEstimate(serviceIds, vehicle='car', urgent=false, catalogue=SERVICES)`, `normalizePhone(value)` and `validateBooking(data, todayISO)`. Filtering returns service objects without mutating the input; unknown categories/sort modes throw. Estimates return exactly `{subtotal, total, minutes}`, deduplicate IDs, and reject unknown IDs/vehicle types and negative/non-finite prices. The optional catalogue enables independent rounding/numeric-sort tests. Phone normalization returns a canonical string or `null`, never strips arbitrary letters into a valid number.

Booking validation returns an error object keyed by `name`, `phone`, `car`, `services`, `date`, `time`, `consent` and, when needed, `comment`; valid input returns `{}`. Input fields are `{name, phone, car, serviceIds, vehicle, urgent, date, time, comment, consent}`. `todayISO` is an explicit local calendar date so tests are deterministic. Reject malformed/nonexistent dates, unknown service IDs/time values, comments over 500 characters and missing consent. Validation must not mutate input. Read-only trusted acceptance tests in the QA image exercise this API in addition to the team's own tests; deleting or weakening project tests cannot bypass these domain checks.

Use unique `data-testid` hooks below **in addition to** semantic HTML and accessible names. Hooks are internal attributes and must not appear as customer-facing labels. Inputs must use their appropriate native types; selects/checkboxes must expose their real state. Numeric output hooks must be visible and contain the displayed number; hidden metadata alone is not acceptance evidence.

| Area | Hooks and contract |
| --- | --- |
| Navigation | `mobile-menu-toggle` (aria-expanded); `mobile-menu` when open; `booking-open` (one primary header trigger) |
| Filters | `services-search`, `services-category`, `services-sort`, `services-count` (`data-count`), `services-empty`, `services-reset` |
| Cards | `service-card-ID` (`data-service-id`, `data-price`, `data-minutes`), `service-price-ID`, `service-details-ID` |
| Details | `service-dialog`, `service-details-close`, `service-details-book` |
| Calculator | `calc-service-ID` checkboxes, `calc-vehicle`, `calc-urgent`, `calc-subtotal`/`calc-total` (`data-amount`), `calc-duration` (`data-minutes`), `calc-empty`, `calc-reset`, `calc-book` |
| Booking | `booking-dialog`, `booking-close`, `booking-name`, `booking-phone`, `booking-car`, `booking-date`, `booking-time`, `booking-comment`, `booking-consent`, `booking-vehicle`, `booking-urgent`, `booking-select-service-ID`, `booking-total` (`data-amount`), `booking-submit` |
| Errors | `booking-error-name`, `booking-error-phone`, `booking-error-car`, `booking-error-services`, `booking-error-date`, `booking-error-time`, `booking-error-consent`; every relevant field has `aria-invalid=true` and references its visible error |
| Confirmation | `booking-success` with `role=status` or an equivalent accessible announcement; visible only after a valid demonstration request |

## 10. Verification and completion

Automated tests must cover combined filters, sorting/reset/empty results, numerical calculation/rounding/duplicates/zero/invalid input, estimate-to-booking transfer, required fields, telephone normalization, past dates, preserving values and preventing duplicate submissions.

The registered browser contract exercises service discovery → Details → estimate → vehicle/urgency changes → booking transfer → validation errors → correction → demonstration confirmation, plus keyboard/dialog behaviour and personal-data storage/network checks. The three viewport checks are mandatory. The QA profile runs only isolated snapshots using pinned dependencies and a fresh sandboxed browser. Project test assertions cannot manufacture runner receipts.

Security reviews user-input handling, data leakage and network behaviour. Technical Reviewer independently reviews after QA. Lead completes the task only after actual test/build/browser receipts and explicit QA/Security/Reviewer decisions. Report limitations honestly: automated viewport checks are not a comprehensive accessibility, security or cross-browser audit.

Apply exact file diffs only after Director approval. Never reapply accepted files or relaunch completed work. Final delivery includes the running local URL, files changed, actual checks/results and remaining release limitations.
