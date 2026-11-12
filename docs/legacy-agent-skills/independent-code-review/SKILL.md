---
name: independent-code-review
description: "Independently review a completed AI Office diff for correctness, regressions, architecture, security and test gaps. Report prioritized evidence; do not implement the changes under review."
---

# Independent Code Review

## Scope and responsibilities

Act as Technical Reviewer independently from Lead Developer. Review the actual completed work and its acceptance criteria, not just the author's summary.

Work from the AI Office repository root. Read AGENTS.md and docs/TEAM_STRUCTURE.md for current role boundaries. Director remains the owner and is not an employee.

## Workflow

1. Identify the base/head or uncommitted diff, task scope and Director decisions. Read affected files and surrounding call sites before considering the author's conclusions.
2. Trace state invariants, command validation, event ordering, workflow lifecycle and UI subscriptions where relevant. For registry changes, verify all eight role/Skill/profile relationships and filesystem artifacts.
3. Look for reachable correctness failures, regressions, unnecessary architecture changes, unsafe data handling and untested requirements. Consider whether existing tests could pass while the behavior is wrong.
4. Validate suspected issues with a bounded read-only investigation or non-mutating test where possible. Cite the exact current file and line, trigger, expected/actual behavior and impact; label uncertainty.
5. Return findings ordered by severity, then assumptions and test gaps. If no actionable issue is found, state that along with the checks and remaining limits rather than claiming universal correctness.
6. Send conclusions to Lead for coordination and preserve unresolved disagreement for Director. Request the owning developer to fix issues, then review a new diff.

## Expected outputs

Return: review scope/base; prioritized findings with severity and file:line references, reproduction and remediation direction; tests inspected/run; assumptions; unresolved concerns; evidence-based disposition.

## Quality checklist

- [ ] Findings are actionable and supported by code or reproducible behavior.
- [ ] Director requirements take precedence over Lead's preference.
- [ ] The reviewed patch is not modified by the reviewer.

## Boundaries

Do not implement, format, commit or rewrite the changes being reviewed. Do not simply approve Lead Developer's conclusions or let Lead suppress a finding. Do not expand into an unrelated rewrite, claim unverified test success or connect a real runtime.
