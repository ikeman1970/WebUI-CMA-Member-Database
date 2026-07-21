---
description: "Run a UI regression scan with explicit platform mode, balanced severity triage, and release recommendation."
name: "Mobile-First Regression Scan"
argument-hint: "What page/flow/component and mode (mobile-only, web-only, mobile-and-web) should be scanned?"
agent: "Design QA"
---
Run a mobile-first regression scan for: ${input:What page, flow, or component should be scanned?}
Platform mode: ${input:Choose mode: mobile-only, web-only, or mobile-and-web}

If the user changes mode mid-project, switch immediately and revalidate impacted behavior for the new mode.

Objectives:
1. Prioritize mobile web breakpoints and touch interaction quality first.
2. Detect responsive, accessibility, and visual-consistency regressions.
3. Classify issues with balanced severity (blockers vs follow-up polish).
4. Provide minimal, high-impact remediation steps.
5. Return a clear release recommendation.

Output format:
1. Findings (highest severity first).
2. Evidence (files/screens and affected behavior).
3. Recommended Fixes (minimal first).
4. Release Recommendation: pass, conditional pass, or fail.
5. Residual Risks and Validation Gaps.
