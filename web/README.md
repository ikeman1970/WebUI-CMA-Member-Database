# CMA Member Database Web App

This directory contains a Next.js + Prisma starter web app for your motorcycle organization member database.

## Setup

1. Install dependencies:
   ```bash
   cd web
   npm install
   ```

2. Create a `.env` file from `.env.example`.
   - For local testing, use `DATABASE_URL="file:./dev.db"`
   - For Supabase, use your provided Postgres URL and replace `<password>` with your Supabase DB password.

3. If using Supabase auth, also set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Optional one-time bootstrap login values:
     - `BOOTSTRAP_ROOT_EMAIL`
     - `BOOTSTRAP_ROOT_USERNAME`
     - `BOOTSTRAP_ROOT_PASSWORD`

4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

5. Create the database schema:
   ```bash
   npm run prisma:migrate
   ```

6. Run the dev server:
   ```bash
   npm run dev
   ```

## Supabase notes

- The app uses Prisma to connect to your Supabase Postgres database via `DATABASE_URL`.
- Existing API routes will work with Supabase as the database backend.
- The Supabase client helpers are available in `src/lib/supabaseClient.ts` and `src/lib/supabaseServer.ts` for future auth integration.
- Do not commit your `SUPABASE_SERVICE_ROLE_KEY` to source control.

## Supabase CLI setup

If you want to use the Supabase CLI for local development:

```bash
npm install -g supabase
supabase login
supabase init
supabase link --project-ref cldgzfqoldsdpgcugbcj
```

Then use `supabase start` or `supabase db push` as needed for local testing.

## Notes

- The current auth API is a simple password check and should be upgraded to sessions / JWT.
- The Prisma schema maps your iOS Core Data model into a web-ready relational schema.
- Chapters and members are supported; additional screens can be added from the SwiftUI views.

## One-Time Bootstrap Root Login

- If `BOOTSTRAP_ROOT_EMAIL` and `BOOTSTRAP_ROOT_PASSWORD` are set, the app can create a root admin account on first login.
- The bootstrap path only works when there are no existing accounts with role `root`, `superuser`, or `admin`.
- After the first admin account exists, bootstrap login is automatically disabled.
- Use the same login form with either `BOOTSTRAP_ROOT_EMAIL` or `BOOTSTRAP_ROOT_USERNAME` plus `BOOTSTRAP_ROOT_PASSWORD`.

## Invite Onboarding And Email Safety

- Creating or importing a member with an email now provisions a linked web account and marks it as `mustChangePassword`.
- Login is blocked for those accounts until password setup is completed with a one-time invite token.
- Safe default: invite email sending is disabled unless `ENABLE_INVITE_EMAIL_SEND=true`.
- In non-production, real invite email sends require the recipient to be in `NON_PROD_EMAIL_ALLOWLIST`.
- Generated setup links are still returned by APIs for controlled dev/test workflows.

## Workbook Import Security Controls

- Member/reporting workbook imports are restricted to `.xlsx`/`.xls` files with allowed workbook MIME types.
- Workbook file size is capped at 2 MB and sheet count is capped to reduce parser abuse risk.
- Parsed row limits are enforced before import processing:
   - member import: 5,000 rows
   - reporting import: 3,000 rows
- Import endpoints remain authenticated and role-scoped; reporting import is also chapter-scope validated.
- Residual risk: `xlsx` currently reports upstream High advisories without a direct patch; compensating controls above are required until replacement/mitigation is completed.

## Local Internal Demo Automation

Use these commands for a tight local-hosted internal demo flow:

- `npm run demo:doctor`
   - Verifies required onboarding schema and auto-applies the invite migration SQL if missing.
- `npm run demo:seed-accounts`
   - Provisions/updates linked member accounts from existing member records for demo test users.
- `npm run demo:audit`
   - Prints dataset and structure readiness (people/accounts/chapters and model availability).
- `npm run demo:prep`
   - Runs doctor + account seeding + audit in sequence.
- `npm run demo:interactive`
   - Runs full prep then starts hot-reload dev server for interactive demo.

Recommended demo sequence:

1. `npm run demo:interactive`
2. Sign in through `/`.
3. Validate member/account linkage in Members and chapter workflows.
4. Test invite setup flow at `/set-password`.
