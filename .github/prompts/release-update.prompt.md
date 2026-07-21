---
description: "Create stakeholder-ready release updates from completed work, with business impact, risks, and next steps."
name: "Release Update"
argument-hint: "What release, sprint, or change set should be summarized?"
agent: "CEO Manager"
---
Create a stakeholder release update for: ${input:What release, sprint, or change set should be summarized?}

Use the current workspace context and include:
1. What shipped: concise list of delivered capabilities.
2. Business impact: user/team value and operational outcomes.
3. Risk status: known risks, mitigations, and remaining exposure.
4. Deployment confidence: test/build validation and release readiness.
5. Next actions: top 3 decisions or follow-up items.

Output style:
- Executive-ready and concise.
- Plain language with specific outcomes.
- No filler text.
