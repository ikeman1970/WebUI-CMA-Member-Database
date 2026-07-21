---
description: "Use when implementing or reviewing internet-exposed code paths to enforce a consistent application security checklist and release-gate expectations."
name: "Security Review Checklist"
applyTo:
  - "web/src/pages/api/**"
  - "web/src/lib/**"
  - "web/src/pages/**"
  - ".github/agents/**"
  - ".github/prompts/**"
---
# Security Review Checklist

- Treat externally reachable behavior as hostile-input territory.
- Prefer least privilege and explicit authorization checks over implicit trust.
- Validate all input boundaries and fail safely with non-sensitive error responses.
- Never expose credentials, tokens, secrets, or sensitive internals in output/logs.

## Required Security Checks

- Authentication and Session:
- Verify session validity and expiry handling for protected paths.
- Confirm cookie/session assumptions across host/protocol boundaries.

- Authorization and Access Control:
- Verify role and scope checks on every admin- or data-sensitive operation.
- Test misuse paths (cross-chapter access, privilege escalation, unauthorized mutation).

- Input and Data Handling:
- Validate malformed and out-of-bound inputs.
- Ensure unsafe input does not bypass validation or trigger sensitive failures.

- Dependency and Configuration Risk:
- For web scope, run `npm audit --audit-level=high` and record output.
- Flag vulnerable dependencies with High/Critical severity as release blockers unless mitigated.

## Security Release Gate

- Fail on unresolved High/Critical findings, confirmed auth bypass, or exploitable injection path.
- Conditional pass only when remaining findings are Low/Medium with compensating controls, owners, and deadlines.
- Pass only when required checks are completed with evidence and no unresolved High/Critical findings remain.

## Evidence Requirements

- Distinguish executed checks from planned checks.
- Record command/check, outcome, and key observations.
- Map each failed check to a defect with severity and mitigation status.
- Include a concise decision log entry: Decision, Context, Options Considered, Rationale, Impact, Risks and Mitigations, Validation Plan, Follow-ups.
