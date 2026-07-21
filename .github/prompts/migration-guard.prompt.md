---
description: "Run a pre-merge migration safety gate for Prisma and Supabase changes, including rollback and blast-radius checks."
name: "Migration Guard"
argument-hint: "What migration change set or PR should be reviewed?"
agent: "Risk Reviewer"
---
Perform a migration safety gate review for: ${input:What migration change set or PR should be reviewed?}

Focus on:
1. Data integrity risks: destructive changes, type mismatches, nullability shifts, key/constraint impacts.
2. Compatibility risks: application code and migration sequence alignment.
3. Rollback readiness: reversible path or mitigation if irreversible.
4. Operational risks: lock duration, large-table impact, migration ordering, environment drift.
5. Verification gap: what tests/checks are missing before release.

Output format:
1. Release Gate Verdict: pass, pass-with-conditions, or block.
2. Critical Findings: severity-ranked with file-level evidence.
3. Required Actions Before Merge.
4. Rollback Plan Summary.
5. Residual Risk if shipped today.
