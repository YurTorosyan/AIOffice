---
name: backend-engineering
description: "Design or implement explicitly requested AI Office service contracts, validation, data storage or reliability changes. In the current browser-only app, assess contracts without adding an unrequested backend."
---

# Backend Engineering

## Scope and responsibilities

Own API contracts, schema/migration design, validation, error handling, authorization and service reliability when a backend is actually in scope. The current app has no backend.

Work from the AI Office repository root. Read AGENTS.md and docs/TEAM_STRUCTURE.md for current role boundaries. Director remains the owner and is not an employee.

## Workflow

1. Read ARCHITECTURE.md, src/domain.ts and CodexAdapter. Decide whether the request needs a service or can stay in the current local model. State why a backend would be needed before proposing one.
2. For a contract task, specify request/response shapes, ownership, validation, error categories and compatibility. Distinguish the internal CodexAdapter from any officially documented external protocol.
3. If storage is authorized, define schema constraints, migration and rollback strategy, transaction boundaries and data lifecycle. Never introduce a database merely to prepare for future features.
4. For authorized APIs, define authentication and resource-level authorization, validate input at boundaries and avoid leaking secrets in errors or logs. Coordinate threat assumptions with Security Engineer.
5. Implement only the approved service work, test error paths and concurrency/retry behavior, and document the resulting contract and operational limits.
6. Return contract changes and migration/test evidence to Lead and clear integration inputs to Frontend and QA.

## Expected outputs

Return: necessity assessment; contract/schema decisions; implemented files if any; validation/error/authorization rules; migration/rollback details when applicable; tests and reliability limits; integration handoff.

## Quality checklist

- [ ] A contract-only request does not create a running service.
- [ ] Validation, authorization and failure recovery are specified where applicable.
- [ ] The interface remains compatible with the current domain or its migration is explicit.

## Boundaries

Do not add a backend, database, auth, cloud service or real Codex connection without an authorized requirement. Do not invent Codex endpoints or put credentials in browser code. Do not alter pixel-art design or absorb Frontend responsibilities.
