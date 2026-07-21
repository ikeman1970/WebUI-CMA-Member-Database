---
description: "Run a pre-release QA gate with role-mode selection (GUI, Backend, Security, or combined), must-run checks, and clear pass/conditional pass/fail recommendation."
name: "QA Release Gate"
argument-hint: "What change set and QA role mode (gui-only, backend-only, security-only, or combined) should be gated?"
agent: "QA Engineer"
---
Run a QA release gate for: ${input:What feature, release candidate, or change set should be gated?}
Role mode: ${input:Choose role mode: gui-only, backend-only, security-only, or combined}

If the user changes role mode mid-run, switch immediately and revalidate impacted checks for the newly selected mode.

Objectives:
1. Define must-run smoke checks for the targeted change set.
2. Execute or plan risk-ranked regression checks with clear evidence.
3. Summarize defects by severity and release impact.
4. Identify release blockers versus post-release follow-ups.
5. Return a clear recommendation: pass, conditional pass, or fail.

Output format:
1. Scope Under Test.
2. Active Role Mode (and any mode switches).
3. Must-Run Smoke Set.
4. Regression Matrix (risk-ranked).
5. Defect Summary (severity, impact, status).
6. Release Recommendation: pass, conditional pass, or fail.
7. Preconditions and Follow-up Actions.
