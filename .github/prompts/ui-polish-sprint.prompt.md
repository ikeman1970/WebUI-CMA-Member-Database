---
description: "Run a focused UI polish sprint on a specific page or component with explicit platform mode and responsive/accessibility checks."
name: "UI Polish Sprint"
argument-hint: "What page/component and mode (mobile-only, web-only, mobile-and-web) should be polished?"
agent: "GUI Designer"
---
Run a focused UI polish sprint for: ${input:What page or component should be polished?}
Platform mode: ${input:Choose mode: mobile-only, web-only, or mobile-and-web}

If the user changes mode mid-project, switch immediately and revalidate impacted UI behavior for the new mode.

Objectives:
1. Identify the top UX and visual friction points for this screen.
2. Apply a cohesive visual improvement pass with minimal scope expansion.
3. Validate responsive behavior for desktop and mobile layouts.
4. Validate accessibility basics: contrast, focus visibility, and semantic clarity.
5. Confirm build/lint success after changes.

Output format:
1. Design Direction Summary.
2. Active Mode (and any mode switches).
3. UI Changes Applied (files + purpose).
4. Responsive and Accessibility Validation.
5. Risks/Tradeoffs.
6. Next 1-3 UI Iterations.
