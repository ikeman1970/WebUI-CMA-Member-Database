---
description: "Use when reporting project delivery status to enforce consistent confidence scoring, risk thresholds, and escalation triggers."
name: "Delivery Risk Thresholds"
applyTo:
  - ".github/prompts/**"
  - ".github/agents/**"
  - "AGENTS.md"
---
# Delivery Risk Thresholds

- Report confidence and risk using consistent, explicit thresholds.
- Escalate early when schedule confidence degrades.
- Keep blockers, ownership, and next actions visible in every status report.
- Separate immediate release blockers from follow-up risks.

## Confidence Scale

- High: on-track with no unresolved critical dependency risk.
- Medium: manageable risk exists; mitigation in progress with owner.
- Low: likely miss or quality compromise without immediate intervention.

## Escalation Triggers

- Any critical-path task is blocked beyond one reporting cycle.
- Two or more medium risks converge on the same milestone.
- A high-severity quality/security issue threatens release readiness.
- Required validation gates are incomplete near milestone deadline.

## Required Status Elements

- Scope and milestone target.
- Confidence level with rationale.
- Completed, in-progress, and blocked items.
- Top risks with owner, mitigation, and contingency.
- Immediate next 1-3 actions with owner and due window.

## Quality Bar

- Confidence rating must map to concrete evidence, not intuition alone.
- Each blocker has one named owner and one next unblock action.
- Escalations are explicit and time-bound.
- Reports remain concise, operational, and decision-ready.
