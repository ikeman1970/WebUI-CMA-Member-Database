---
description: "Cut a broad request into the smallest shippable slice with follow-up backlog and risk-aware sequencing."
name: "Feature Scope Cutter"
argument-hint: "What broad request should be sliced into a smallest shippable increment?"
agent: "Product Manager"
---
Cut this request into a smallest shippable slice: ${input:What broad request should be sliced into a smallest shippable increment?}

Objectives:
1. Identify the user-critical core outcome.
2. Produce a minimal v1 scope that can ship safely.
3. Move non-critical work into a sequenced follow-up backlog.
4. Surface dependencies, blockers, and reversibility concerns.
5. Define measurable acceptance criteria for v1.

Output format:
1. Core Outcome.
2. Minimal v1 Scope.
3. Explicit Out-of-Scope for v1.
4. Follow-up Backlog (ordered by value/risk).
5. Dependencies and Risks.
6. Acceptance Criteria for v1.
7. Ship Decision: ready, ready-with-conditions, or not-ready.
