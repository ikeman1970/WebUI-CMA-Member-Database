---
description: "Generate a backend test matrix for APIs, data integrity, auth, and migration impacts in this repository."
name: "Backend Test Matrix"
argument-hint: "What endpoint, feature, or backend change should be covered?"
agent: "Backend Engineer"
---
Create a backend test matrix for: ${input:What endpoint, feature, or backend change should be covered?}

Include:
1. Contract tests: request/response behavior and validation boundaries.
2. Auth and permission tests: role/scope failures and success paths.
3. Data integrity tests: idempotency, uniqueness, and month/chapter scoping.
4. Migration compatibility tests: old/new schema behavior and upgrade ordering.
5. Failure-mode tests: malformed input, partial updates, and recovery behavior.

Output format:
1. Test Matrix Table: scenario, type, expected result, priority.
2. Must-run smoke set for pre-release.
3. High-risk edge cases not currently covered.
4. Suggested automation order.
