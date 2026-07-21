---
description: "Map component boundaries, contracts, and failure modes before implementing cross-system changes."
name: "Integration Boundary Map"
argument-hint: "What feature or flow needs boundary mapping?"
agent: "Solution Architect"
---
Create an integration boundary map for: ${input:What feature or flow needs boundary mapping?}

Objectives:
1. Identify participating components and ownership boundaries.
2. Define interface contracts (inputs, outputs, error behavior, trust assumptions).
3. Enumerate dependency and failure modes across boundaries.
4. Propose compatibility-safe sequencing for implementation and rollout.
5. Highlight observability checkpoints for detection and recovery.

Output format:
1. Scope and Components.
2. Boundary Contracts.
3. Dependency Graph and Critical Paths.
4. Failure Modes and Blast Radius.
5. Sequencing Plan (compatibility-first).
6. Observability and Recovery Hooks.
7. Top Risks and Mitigations.
