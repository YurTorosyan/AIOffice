# ARMGARAGE heading acceptance correction

The project's authoritative README section 2 requires ARMGARAGE identity in the header and an automotive value proposition in the hero. Section 7 requires accessible semantics. Neither section 2 nor the stable QA hooks require an H1 with the exact accessible name `ARMGARAGE`. The customer-facing interface must be Russian. The existing Russian value-proposition H1 therefore must not fail simply because it differs from the brand.

The trusted browser contract now checks the visible header for ARMGARAGE identity and separately requires a visible, accessibly named, nonempty H1. It leaves the headline copy to the design. Every filter, calculator, booking, privacy, keyboard and viewport assertion after that initial check is unchanged. Missing brand, missing H1, empty H1 and hidden H1 remain failures.

No ARMGARAGE source, stylesheet, project test or README was edited. The existing completed Frontend response, workflow tasks, approvals and QA receipts remain preserved and the workflow stays paused. The original failing report remains evidence of the previous contract; it is not rewritten or marked PASS. No Codex task or complete project QA run was repeated.

## Validation and image

Two isolated Chromium regression tests used synthetic HTML only: two different Russian headlines at 390/768/1440 px pass, while missing identity/heading and blank/hidden headings fail. Run them with:

```powershell
node --experimental-strip-types scripts/check-armgarage-heading.mjs
```

The fixture uses the same pinned image, non-root user, sandboxed Chromium, no network, no host mounts and bounded resources. It never builds or opens the actual project. Twelve related executor/report tests and the AI Office production TypeScript/Vite build also passed.

A new immutable ARMGARAGE image was built by copying only the corrected contract over the existing local image, without dependency installation. Previous pin: `sha256:0907675574498661a48ea1ff3128266ada1b461bceda71d9864aad73960d308a`. New pin: `sha256:02ece31f66726a206f1b0287a4710f384e8710b4ff9913819d3c1c4b576712cc`. The full Dockerfile also copies this corrected source on future rebuilds. Coffee House's image and profile were not changed.

The running bridge imported the old pin before this correction. It must be restarted to load the new one. No automatic restart, project test rerun, workflow resume or model continuation is included in this change. Future QA evidence must use the new pinned verification identity; historical receipts remain unchanged.
