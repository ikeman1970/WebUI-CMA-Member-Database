---
description: "Use when designing or implementing high-impact architecture changes to enforce minimum architecture review gates before merge or release."
name: "Architecture Review Gates"
applyTo:
  - "web/src/**"
  - "web/prisma/**"
  - "web/supabase/migrations/**"
  - ".github/prompts/**"
  - ".github/agents/**"
  - "AGENTS.md"
---
# Architecture Review Gates

- Prefer smallest viable architecture increment before broad redesign.
- Keep boundaries explicit: ownership, contracts, and failure behavior.
- Sequence changes for compatibility-first rollout and safe fallback.
- Surface cross-cutting impacts early: security, data integrity, performance, and operability.

## Required Gates

- Problem/Context Gate:
- Decision scope, constraints, and success criteria are explicit.

- Boundary/Contract Gate:
- Affected components and API/data contracts are identified.
- Failure behavior and dependency assumptions are documented.

- Compatibility/Rollout Gate:
- Rollout sequence supports coexistence of old/new behavior where required.
- Fallback/rollback approach is defined for high-impact changes.

- Verification Gate:
- Validation checks are concrete and reproducible.
- Build/runtime checks and targeted smoke paths are identified.

- Risk Gate:
- Critical risks, blast radius, and mitigations are explicitly listed.
- Blockers vs follow-up items are clearly separated.

## Quality Bar

- Another engineer can implement from the architecture output without ambiguity.
- Decision rationale includes options considered and tradeoffs.
- Cross-boundary changes include observability/recovery checkpoints.
- Residual risk is documented when any gate is partially satisfied.
