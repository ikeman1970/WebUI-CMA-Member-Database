---
description: "Standardize defect triage with QA role-mode selection (GUI, Backend, Security, or combined), reproduction steps, severity, impact scope, and owner-ready remediation plan."
name: "Defect Triage"
argument-hint: "What bug and QA role mode (gui-only, backend-only, security-only, or combined) should be triaged?"
agent: "QA Engineer"
---
Triaging defect: ${input:What bug or quality issue should be triaged?}
Role mode: ${input:Choose role mode: gui-only, backend-only, security-only, or combined}

If the user changes role mode mid-run, switch immediately and update reproduction and validation focus for the new mode.

Objectives:
1. Produce deterministic reproduction steps and expected vs actual behavior.
2. Classify severity and user/business impact.
3. Identify likely component ownership and affected scope.
4. Propose minimal fix direction and verification checks.
5. Define release impact: blocker, conditional, or follow-up.

Output format:
1. Defect Summary.
2. Active Role Mode (and any mode switches).
3. Reproduction Steps.
4. Expected vs Actual Behavior.
5. Severity and Impact Scope.
6. Suspected Area and Owner Recommendation.
7. Fix Direction and Verification Checklist.
8. Release Impact: blocker, conditional, or follow-up.
