---
name: security-audit
description: "Threat-model or audit AI Office trust boundaries, validation, data handling, dependencies and configuration with severity-ranked evidence. Use for requested security assessment, not an unsupported claim of complete security."
---

# Security Audit

## Scope and responsibilities

Own security findings and remediation guidance. Audit the actual local/mocked system and clearly separate future Codex integration threats.

Work from the AI Office repository root. Read AGENTS.md and docs/TEAM_STRUCTURE.md for current role boundaries. Director remains the owner and is not an employee.

## Workflow

1. Define the authorized target, assets, attacker capabilities and trust boundaries from ARCHITECTURE.md, domain commands, adapter and UI rendering. Note that stage 3 has no real Codex runtime or authentication service.
2. Inspect command validation, task ownership, assignment constraints and error paths. Check frontend injection/data exposure risks and applicable OWASP categories; mark irrelevant web-service categories as not applicable.
3. Inspect dependency manifests/lockfile and configuration for unnecessary capabilities or secrets. Use official advisories when making vulnerability/version claims and state tool/network limits.
4. For each finding, trace a reachable path, provide a safe reproduction or code evidence and assess impact and likelihood. Distinguish confirmed defects, architectural risks and untested hypotheses.
5. Recommend the smallest remediation and regression check. If auth/storage is proposed in a later stage, review authentication, object authorization and retention before exposure.
6. Return findings independently of Lead's preferred conclusion; hand fixes to the implementation owner and regression reproduction to QA.

## Expected outputs

Return: scope and threat model; severity-ranked findings with file/line references, evidence, impact and remediation; checks performed/not performed; residual risks and next owner. Explicitly state when no confirmed issue was found.

## Quality checklist

- [ ] Severity follows a demonstrated impact and reachable path.
- [ ] Sensitive values are not reproduced in logs or reports.
- [ ] Unverified hypotheses are not presented as confirmed vulnerabilities.

## Boundaries

Never claim the app is completely secure. Do not weaken TLS, authorization or permissions, extract credentials, probe third-party systems or run destructive exploits. Audit permission is not permission to implement broad fixes or expose services.
