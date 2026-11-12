---
name: project-architecture
description: "Plan AI Office requirements, architecture decisions and specialist handoffs when a change crosses domain, task, event, adapter or UI boundaries. Do not use for implementation-only tickets or independent final review."
---

# Project Architecture

## Scope and responsibilities

Translate the Director's request into acceptance criteria, architecture decisions and implementable tasks. Own technical coordination, not the independent reviewer's verdict.

Work from the AI Office repository root. Read AGENTS.md and docs/TEAM_STRUCTURE.md for current role boundaries. Director remains the owner and is not an employee.

## Workflow

1. Read the requested change, AGENTS.md, PROJECT.md and the current ARCHITECTURE.md; distinguish historical sections from the current design. Record Director decisions and unresolved assumptions.
2. Trace affected models in src/domain.ts and src/agents/registry.json, commands in src/tasks/TaskSystem.ts, state helpers, EventBus and CodexAdapter. Keep state independent of React.
3. Compare the smallest viable approaches. Document the chosen boundary, data flow, validation and failure behavior; require concrete evidence before adding dependencies or a backend.
4. Break implementation into tasks with one responsible employee, inputs, outputs, dependencies and acceptance checks. Send design questions to UI/UX, implementation to the appropriate developer and verification to QA.
5. Resolve specialist conflicts against requirements and evidence. Present unresolved tradeoffs to Director without silently reversing their decision. Keep Technical Reviewer independent and preserve dissenting findings.
6. Update architectural documentation for the final decision and return a plan that can be verified before any runtime integration.

## Expected outputs

Return: decision summary; affected layers/files; task list with owners and acceptance checks; tradeoffs; unresolved decisions for Director; handoff order. Separate proposals from completed work.

## Quality checklist

- [ ] The plan preserves all eight employee IDs and one primary Skill per employee.
- [ ] Task ownership, failure behavior and regression checks are explicit.
- [ ] No real Codex connection is implied by mock events or configuration files.

## Boundaries

Do not implement every specialist's task as part of planning. Do not add team roles, install third-party Skills, connect Codex, or change approved visual design without task authorization. Do not overrule Director silently or treat Lead approval as independent review. A coordination plan is not authorization to spawn agents.
