---
description: "Use when creating or editing CI/CD workflows, release scripts, or automation tied to build, test, deploy, or migration execution."
name: "CI Workflow Standards"
applyTo:
  - ".github/workflows/**"
  - "scripts/**"
---
# CI Workflow Standards

- Keep workflows deterministic: pin actions/versions and avoid hidden mutable defaults.
- Fail fast on critical gates: type/build/test/migration safety checks should stop the pipeline when failing.
- Prefer explicit environment assumptions: document required vars, secrets, and runtime dependencies.
- Avoid irreversible production steps without guarded conditions and rollback strategy.

## Safety and Sequencing

- Run build and validation gates before deploy actions.
- Sequence migration-sensitive steps safely: compatibility first, rollout second, cleanup last.
- Treat migrations as release-critical and include clear failure handling.

## Observability and Debuggability

- Emit enough logs/artifacts to diagnose failures quickly.
- Keep step names clear and operationally meaningful.
- Include a minimal post-deploy verification stage where applicable.

## Change Discipline

- Keep workflow changes minimal and targeted.
- Document why each new workflow or gate exists.
- If introducing conditional paths, ensure non-happy paths are testable and visible.
