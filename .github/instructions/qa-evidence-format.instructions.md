---
description: "Use when producing QA validation output to enforce consistent evidence formatting for test strategy, execution, defects, and release recommendation."
name: "QA Evidence Format"
applyTo:
  - ".github/prompts/**"
  - ".github/agents/**"
  - "web/src/**"
---
# QA Evidence Format Standards

- Report only checks that were actually executed; distinguish planned vs executed clearly.
- Include enough detail that another engineer can reproduce results without guesswork.
- Keep severity and release impact explicit and consistent.
- Separate release blockers from non-blocking follow-up items.

## Required Sections

- Scope Under Test: feature, files, flows, and environment assumptions.
- Test Strategy: must-run smoke checks and risk-ranked regression coverage.
- Execution Evidence: command/check, result, and key observations.
- Defects: severity, reproduction steps, impact scope, and status.
- Release Recommendation: pass, conditional pass, or fail with rationale.
- Follow-ups: immediate actions, owner, and priority.

## Severity Guidance

- Critical: data loss, security exposure, or hard outage; release blocker.
- High: major user path broken or incorrect business outcome; usually blocker.
- Medium: degraded behavior with workaround; conditional release depending on risk concentration.
- Low: cosmetic or minor UX issue; follow-up unless combined risk elevates impact.

## Quality Bar

- Every failed check maps to a defect entry.
- Every recommendation includes concrete conditions and next actions.
- Residual risk is stated when coverage is partial.
- Evidence should be concise, factual, and free of ambiguous language.
