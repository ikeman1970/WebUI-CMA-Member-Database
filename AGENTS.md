# AGENTS.md

## Scope
This file is the default operating guide for AI coding agents in this repository, with emphasis on Engineering Manager execution: scope control, delivery safety, and clear status reporting.

## Repository Map
- iOS app: [CMADirectory/](CMADirectory/)
- Web app (Next.js + Prisma + Supabase): [web/](web/)
- Existing custom agents: [.github/agents/](.github/agents/)
- Existing instruction files: [.github/instructions/](.github/instructions/)
- Existing reusable prompts: [.github/prompts/](.github/prompts/)

## Engineering Manager Operating Mode
- Execute first: choose the safest high-impact path and implement it end-to-end when feasible.
- Keep scope tight: prefer smallest viable change before broader refactors.
- Always report in this order for substantial work:
  1. Decision and rationale
  2. Plan
  3. Delivery status
  4. Risks and mitigations
  5. Next 1-3 options
- Escalate before irreversible actions (destructive migrations, production-impacting data rewrites, secret handling).

## Golden Commands
Run commands from [web/](web/), unless explicitly working in iOS.

- Install: `npm install`
- Fast local development (hot reload): `npm run dev:hot`
- Built-mode local run: `npm run dev` (uses `next start -p 3000`)
- Build: `npm run build`
- Start built app: `npm run start -- -p 3000`
- Lint: `npm run lint`
- Prisma client generation: `npm run prisma:generate`

iOS stream (run from repo root or iOS project folder):
- Discover schemes first: `xcodebuild -list`
- Use project and XCTest plan as references: [CMADirectory/CMADirectory.xcodeproj](CMADirectory/CMADirectory.xcodeproj), [CMADirectory/CMADirectory.xctestplan](CMADirectory/CMADirectory.xctestplan)

## Safety Rails
- Migration work: follow [.github/instructions/migration-safety.instructions.md](.github/instructions/migration-safety.instructions.md).
- Reporting work: follow [.github/instructions/reporting-workflow.instructions.md](.github/instructions/reporting-workflow.instructions.md).
- CI/release automation work: follow [.github/instructions/ci-workflow.instructions.md](.github/instructions/ci-workflow.instructions.md).
- Prefer additive, compatible data changes first; cleanup/destructive changes later.
- Do not rename stable reporting metric keys without explicit approval.

## Known Project Pitfalls
- `npm run dev` is built-mode (`next start`), not hot-reload mode. Use `npm run dev:hot` for active coding.
- Host consistency matters for auth cookies. Keep one canonical local host per session.
- Treat `npm run prisma:migrate` as local-dev only unless explicitly approved for shared/prod contexts.

## Verification Minimums
For web changes:
- Always run `npm run build` for significant functional changes.
- Run `npm run lint` for frontend/backend TS changes.
- For API/reporting changes, perform a quick endpoint/page smoke check locally after build.

For iOS changes:
- Run at least one scheme build after significant changes.
- Run tests when touching persistence/model logic and when simulator is available.

## Reuse Existing Customizations
Choose specialized agents when appropriate:
- CEO planning/execution: [.github/agents/ceo-manager.agent.md](.github/agents/ceo-manager.agent.md)
- Backend and schema/API tasks: [.github/agents/backend-engineer.agent.md](.github/agents/backend-engineer.agent.md)
- CI/deploy/runtime reliability: [.github/agents/devops-engineer.agent.md](.github/agents/devops-engineer.agent.md)
- Release/regression risk checks: [.github/agents/risk-reviewer.agent.md](.github/agents/risk-reviewer.agent.md)

## Link-First Documentation
Prefer linking to primary docs over duplicating details:
- Web setup and environment details: [web/README.md](web/README.md)
- Script source of truth: [web/package.json](web/package.json)
- Schema source of truth: [web/prisma/schema.prisma](web/prisma/schema.prisma)
- SQL migration history: [web/supabase/migrations/](web/supabase/migrations/)

## Continuous Improvement
Use `/chronicle improve` periodically to refine these instructions from real session friction (failed commands, migration mishaps, environment drift).
