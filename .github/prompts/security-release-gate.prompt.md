---
description: "Run a strict pre-release security gate with required checks, vulnerability evidence, and pass/conditional pass/fail recommendation."
name: "Security Release Gate"
argument-hint: "What feature, endpoint, or release candidate should be security-gated?"
agent: "Security Engineer"
---
Run a strict security release gate for: ${input:What feature, endpoint, or release candidate should be security-gated?}

Objectives:
1. Define internet-exposed attack surface and trust boundaries.
2. Execute required checks, including dependency vulnerability scanning and auth/access misuse checks.
3. Identify exploitable paths and classify findings by severity.
4. Separate release blockers from conditional-release items with compensating controls.
5. Return a strict security recommendation: pass, conditional pass, or fail.

Required checks:
- Dependency scan (`npm audit --audit-level=high` for web scope).
- Auth/session boundary checks for protected actions.
- Access-control misuse checks for role/scoped data.
- Malformed/unsafe input checks for changed request paths.

Output format:
1. Security Scope Under Test.
2. Test Strategy (must-run checks + risk-ranked matrix).
3. Execution Evidence (executed vs planned checks).
4. Findings (severity, exploit path, affected scope, status).
5. Security Recommendation: pass, conditional pass, or fail.
6. Preconditions and Follow-up Hardening Actions.
7. Decision Log Entry (Decision, Context, Options Considered, Rationale, Impact, Risks and Mitigations, Validation Plan, Follow-ups).
