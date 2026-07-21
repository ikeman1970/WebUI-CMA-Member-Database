---
description: "Use when modifying web UI pages/components/styles to enforce accessibility, responsive behavior, and consistent visual quality."
name: "UI Standards"
applyTo:
  - "web/src/pages/**/*.tsx"
  - "web/src/components/**/*"
  - "web/src/styles/**/*"
  - "web/src/**/*.css"
---
# UI Standards

- Preserve existing product workflows while improving presentation and clarity.
- Prefer targeted, coherent UI updates over broad visual rewrites.
- Keep visual hierarchy clear through typography, spacing, and contrast.
- Ensure desktop and mobile layouts both work before completion.

## Accessibility Baseline

- Maintain readable contrast for text, controls, and status indicators.
- Ensure visible focus states for interactive elements.
- Keep semantic structure clear: headings, labels, and actionable controls.
- Avoid interaction patterns that require pointer-only behavior.

## Responsive Behavior

- Validate key breakpoints with practical checks, not assumptions.
- Prevent overflow/cropping of critical controls and status messages.
- Keep filter/forms/actions usable on narrow screens.
- Prioritize content and action order for mobile users.

## Consistency and Components

- Reuse existing component patterns and tokens where available.
- Keep spacing, border radius, elevation, and state styling consistent.
- Use concise visual feedback for loading, success, empty, and error states.

## Verification

- Run lint/build checks after meaningful UI changes.
- If UI behavior changed, verify the corresponding page interaction flow.
- Call out any accessibility or responsive tradeoffs explicitly in the final report.
