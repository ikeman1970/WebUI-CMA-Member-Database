---
description: "Create a concise threat model for a feature or change with assets, trust boundaries, abuse cases, and mitigations."
name: "Threat Model Lite"
argument-hint: "What feature, endpoint, or workflow should be threat-modeled?"
agent: "Security Engineer"
---
Create a threat model lite for: ${input:What feature, endpoint, or workflow should be threat-modeled?}

Objectives:
1. Identify key assets, entry points, and trust boundaries.
2. Enumerate realistic abuse cases and attacker goals.
3. Rate risk by likelihood and impact.
4. Propose minimal, high-impact mitigations and verification checks.
5. Define release preconditions for externally exposed risk.

Output format:
1. System Scope and Assumptions.
2. Assets and Trust Boundaries.
3. Attack Surface and Entry Points.
4. Top Abuse Cases (with likelihood/impact).
5. Mitigations (immediate and follow-up).
6. Verification Plan (security checks to run).
7. Release Preconditions and Residual Risk.
8. Decision Log Entry (Decision, Context, Options Considered, Rationale, Impact, Risks and Mitigations, Validation Plan, Follow-ups).
