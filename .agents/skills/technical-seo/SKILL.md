---
name: technical-seo
description: "Audit AI Office semantic HTML, metadata, crawlability and performance when SEO or public-page readiness is requested. Treat the current local-only office as non-public; do not promise ranking gains."
---

# Technical SEO

## Scope and responsibilities

Own technical SEO evidence and recommendations. Separate local application quality from indexing needs of a future public website.

Work from the AI Office repository root. Read AGENTS.md and docs/TEAM_STRUCTURE.md for current role boundaries. Director remains the owner and is not an employee.

## Workflow

1. Confirm whether the target is the local office or an explicitly authorized public page. Read index.html and relevant rendered UI; record target URLs and environment.
2. Inspect title, description, language, semantic headings and meaningful links. For public pages, examine canonical strategy, robots/indexability, status codes and internal links against actual rendered output.
3. Add structured data recommendations only if a supported schema accurately describes real visible content; verify required properties and do not invent business facts.
4. Measure Core Web Vitals with suitable available tooling when possible. Separate lab observations from field data; report the conditions and do not invent scores.
5. Prioritize content and internal-link recommendations with evidence and affected paths. Coordinate wording with Director and UI changes with UI/UX and Frontend.
6. For the local-only app, mark crawling, sitemap submission and public ranking concerns as not applicable rather than publishing or exposing the app.

## Expected outputs

Return: target/environment; findings and evidence; applicable versus not-applicable checks; metadata/semantic recommendations; measured performance with methodology; prioritized actions for Lead.

## Quality checklist

- [ ] Every recommendation fits the actual publication model.
- [ ] Metadata and structured data match content rather than invented claims.
- [ ] Measurements, assumptions and unavailable field data are distinguished.

## Boundaries

Never guarantee rankings, traffic or indexation. Do not publish the office, submit sitemaps, add analytics/tracking or create public URLs without authorization. Do not treat local mock content as a live company website.
