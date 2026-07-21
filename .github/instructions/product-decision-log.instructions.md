---
description: "Use when making product-impacting scope, prioritization, rollout, or tradeoff decisions to maintain a concise, auditable decision log."
name: "Product Decision Log"
applyTo:
  - "web/src/**"
  - ".github/prompts/**"
  - ".github/agents/**"
  - "AGENTS.md"
---
# Product Decision Log Standards

- Record major product decisions with clear rationale and expected impact.
- Keep entries concise, actionable, and tied to a concrete scope boundary.
- Capture alternatives considered and why they were not chosen.
- Explicitly call out risks, mitigation actions, and rollback posture.
- Distinguish release blockers from post-release follow-up items.

## When to Log

- Scope changes that alter the user-facing outcome.
- Prioritization decisions that defer or drop previously planned work.
- Rollout strategy changes, including phased launch or feature flag strategy.
- Decisions that affect reporting semantics, migration timing, or release safety.

## Required Entry Fields

- Decision: what was chosen.
- Context: problem and constraints.
- Options Considered: short list of alternatives.
- Rationale: why this option was selected.
- Impact: expected user/business/engineering effect.
- Risks and Mitigations: known issues and containment.
- Validation Plan: how success or failure will be measured.
- Follow-ups: immediate next actions and owners.

## Quality Bar

- Decision text is specific enough that another engineer can execute it.
- Tradeoffs are explicit; assumptions are visible.
- Validation criteria are measurable, not subjective.
- Follow-ups are prioritized and time-bounded when possible.
