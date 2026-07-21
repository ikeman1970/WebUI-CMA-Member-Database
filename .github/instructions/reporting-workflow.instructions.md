---
description: "Use when modifying reporting APIs, reporting pages, workbook/manual imports, or monthly/quarterly aggregation logic. Enforces reporting data safety and stable metric naming."
name: "Reporting Workflow"
applyTo:
  - "web/src/pages/chapters/reporting.tsx"
  - "web/src/pages/api/reporting/**"
  - "web/src/lib/reporting*"
  - "web/src/lib/eventAttendance.ts"
---
# Reporting Workflow Standards

- Prefer additive changes that preserve existing reporting metric keys.
- Treat manual reporting entry as a first-class path when workbook structures are inconsistent.
- Keep monthly snapshot imports idempotent by chapter + month.
- Preserve trend compatibility: new metrics may be added, existing metric names should not be renamed casually.
- Validate reporting changes with type checks/build before completion.

## Data Safety

- Never delete or overwrite unrelated month/chapter snapshots.
- Avoid assumptions about workbook stability across months.
- If parsing is uncertain, fail clearly and provide manual-entry fallback.

## UX Expectations

- Keep reporting interactions obvious: clear chapter selection, month selection, and success/error messages.
- Use concise import status messaging that tells users exactly what happened.
