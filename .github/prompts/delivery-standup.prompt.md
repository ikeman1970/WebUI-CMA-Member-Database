---
description: "Generate a concise daily delivery standup with milestone status, blockers, owners, and immediate next actions."
name: "Delivery Standup"
argument-hint: "What release, milestone, or workstream should the standup cover?"
agent: "Project Manager"
---
Create a delivery standup for: ${input:What release, milestone, or workstream should the standup cover?}

Objectives:
1. Summarize completed, in-progress, and blocked work.
2. Highlight blockers with owner and unblock action.
3. Report milestone progress and confidence level.
4. Call out top risks and mitigation status.
5. Define immediate next actions for the next 24 hours.

Output format:
1. Scope and Date.
2. Completed Since Last Update.
3. In Progress.
4. Blocked (owner + unblock action).
5. Milestone and Confidence Snapshot.
6. Top Risks and Mitigations.
7. Next 1-3 Actions (owner + due window).
