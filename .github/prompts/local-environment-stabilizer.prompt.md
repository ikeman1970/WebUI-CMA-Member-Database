---
description: "Stabilize local runtime by diagnosing and fixing dev/start/build issues with repeatable steps and cleanup commands."
name: "Local Environment Stabilizer"
argument-hint: "What local environment issue should be stabilized?"
agent: "DevOps Engineer"
---
Stabilize the local environment for: ${input:What local environment issue should be stabilized?}

Objectives:
1. Reproduce and isolate the issue with deterministic commands.
2. Identify root cause category: process state, artifacts/cache, config/env, permissions, or dependency mismatch.
3. Apply the minimum operational fix with explicit rollback/safety notes.
4. Verify with repeatable pass/fail checks.
5. Produce a short runbook for future occurrences.

Output format:
1. Root Cause Summary.
2. Stabilization Steps (exact commands in order).
3. Verification Checklist (build/dev/start results).
4. Preventive Hardening Actions.
