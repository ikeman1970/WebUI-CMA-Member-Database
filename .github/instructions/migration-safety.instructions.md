---
description: "Use when creating or modifying Prisma schema, SQL migrations, or migration-related backend code. Enforces migration safety, sequencing, and rollback readiness."
name: "Migration Safety"
applyTo:
  - "web/prisma/schema.prisma"
  - "web/supabase/migrations/**"
  - "web/src/pages/api/**"
  - "web/src/lib/**"
---
# Migration Safety Standards

- Prefer additive schema changes first; defer destructive removals to a later release.
- Keep migration and application code compatible during deployment transition.
- Validate key and type compatibility explicitly, especially foreign keys and identifier types.
- Treat production ID type conventions as canonical and align migrations accordingly.

## Sequencing Rules

- Stage rollout in safe order: schema support first, then code usage, then cleanup.
- Do not assume a brand-new database path only; support already-migrated environments.
- Ensure idempotent SQL where practical for re-runs and partial deployment retries.

## Rollback and Recovery

- Include rollback strategy or mitigation notes for non-reversible operations.
- Avoid one-way destructive changes unless explicitly approved.
- Surface lock/contention risks for large-table operations.

## Verification

- Run type/build validation for backend-impacting changes.
- Verify migration behavior against current schema assumptions before completion.
- If uncertainty remains, block release recommendation and document required checks.
