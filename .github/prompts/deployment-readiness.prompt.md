---
description: "Assess deployment readiness with operational, migration, and release risk checks before go-live."
name: "Deployment Readiness"
argument-hint: "What release, branch, or change set should be assessed?"
agent: "DevOps Engineer"
---
Assess deployment readiness for: ${input:What release, branch, or change set should be assessed?}

Cover:
1. Build readiness: type/build/start verification status.
2. Configuration readiness: env assumptions, host/runtime requirements.
3. Data readiness: migration ordering, compatibility, rollback preparedness.
4. Operational readiness: monitoring/logging expectations and incident response hooks.
5. Release risk: blockers, conditions, and residual risk.

Output format:
1. Readiness Verdict: ready, ready-with-conditions, or not-ready.
2. Blocking Issues.
3. Required Preconditions Before Deploy.
4. Rollback Plan Snapshot.
5. Post-Deploy Validation Checklist.
