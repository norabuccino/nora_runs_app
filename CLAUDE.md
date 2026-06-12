# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**nora_runs_app** — helps the user plan marathon training and strength training.

- **Repo:** https://github.com/norabuccino/nora_runs_app
- **Domain:** noraboo22.com
- **Stack:** Next.js 16 App Router, Supabase (auth + database), Tailwind CSS v4, Vercel

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

Node.js is installed at `/opt/homebrew/bin/node`. If `npm` is not found in PATH, use `/opt/homebrew/bin/npm`.

## Deployment

Push to the `main` branch on GitHub — Vercel auto-deploys on every push.

## After Every Change — Required Steps

After completing any code change, always do both of the following without waiting to be asked:

1. **Commit and push to GitHub:**
   ```bash
   git add <changed files>
   git commit -m "descriptive message"
   git push origin main
   ```

2. **If the change includes a new migration file, apply it immediately** using the Management API (preferred — works when direct DB connections are blocked):
   ```bash
   ACCESS_TOKEN=$(grep ^SUPABASE_ACCESS_TOKEN .env.local | cut -d'=' -f2)
   curl -s \
     -X POST "https://api.supabase.com/v1/projects/btkvovgfsrfvikktoyun/database/query" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"query\": $(cat supabase/migrations/<filename>.sql | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"
   ```
   Then verify by querying `information_schema` to confirm the table/column exists.

## Environment Variables

`.env.local` holds all local values. The Supabase public credentials are also hardcoded as fallbacks in `src/lib/supabase/config.ts` (see note below).

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_DEV_EMAIL        # dev-only login shortcut
NEXT_PUBLIC_DEV_PASSWORD     # dev-only login shortcut
SUPABASE_ACCESS_TOKEN        # for running migrations via CLI
SUPABASE_DB_PASSWORD         # for running migrations via CLI
```

## Known Quirks & Important Decisions

### Supabase credentials are hardcoded in config.ts
`src/lib/supabase/config.ts` hardcodes the Supabase URL and anon key as fallback values. This was necessary because Vercel's `NEXT_PUBLIC_` env vars were not being embedded in the production bundle reliably. The anon key is safe to commit — Supabase uses Row Level Security (RLS) to protect data, not key secrecy. Do not remove the hardcoded fallbacks.

### middleware.ts must stay as middleware.ts
Next.js 16 locally warns to rename `middleware.ts` → `proxy.ts`, but **Vercel does not support `proxy.ts`**. Keep the file named `middleware.ts` and the export named `middleware`. This was confirmed through production debugging.

### Dev login button
The login page shows a one-click "⚡ Dev login" button when `NODE_ENV === 'development'` and `NEXT_PUBLIC_DEV_EMAIL` / `NEXT_PUBLIC_DEV_PASSWORD` are set in `.env.local`. The corresponding Supabase account is `admin@local.dev`.

## Architecture

### Supabase client pattern

Three files work together — use the right one for the context:

- `src/lib/supabase/config.ts` — shared URL/key constants (fallback values hardcoded here)
- `src/lib/supabase/client.ts` — browser client, use in `"use client"` components
- `src/lib/supabase/server.ts` — server client, use in Server Components and Route Handlers (async, reads/writes cookies)

### Auth flow

Auth is enforced in `src/middleware.ts`, which runs on every request. It redirects unauthenticated users away from `/dashboard`, `/plans`, `/my-plan`, and `/paces`, and redirects authenticated users away from `/auth/*` (except `/auth/callback`).

The middleware wraps all Supabase calls in a try/catch — auth failures are logged but never crash the site. Same for `layout.tsx`.

Sign-out is a POST route at `/auth/signout/route.ts` (not a client-side action) to avoid CSRF issues.

### Adding new protected routes

Extend the `isProtectedRoute` check in `src/middleware.ts` to cover any new route prefix that requires authentication.

### Database tables

Seven tables exist in Supabase (all with RLS enabled):

| Table | Purpose |
|---|---|
| `training_plans` | Plan templates (marathon, half, strength, custom) |
| `plan_workouts` | Individual workouts within a plan (week + day slots); has `run_type` column for run variety |
| `workout_steps` | Ordered segments within a workout (warm-up, interval, cool-down), FK → `plan_workouts` |
| `user_plans` | A user's active/past plan assignments with start dates |
| `running_paces` | Named paces (Easy, Tempo, etc.) stored as seconds/mile |
| `workout_logs` | Completion records and per-instance workout overrides |
| `strava_tokens` | OAuth tokens for Strava integration (partially set up) |

### Database schema changes

**Every schema change requires three things — all three, every time:**

1. **Migration file** — create a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql` (timestamp must be newer than the previous migration). Write the SQL using `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF EXISTS` / `CREATE POLICY` so it is safe to re-run.

2. **TypeScript types** — update `src/types/database.ts` to reflect the new or changed table (add/modify the `Row`, `Insert`, and `Update` shapes, and any convenience type aliases at the bottom).

3. **Apply the migration** — use the Management API (preferred, works even when direct DB connections fail due to IPv6/firewall):

```bash
ACCESS_TOKEN=$(grep ^SUPABASE_ACCESS_TOKEN .env.local | cut -d'=' -f2)
curl -s \
  -X POST "https://api.supabase.com/v1/projects/btkvovgfsrfvikktoyun/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(cat supabase/migrations/<filename>.sql | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"
```

An empty array `[]` response means success. Verify with a follow-up query against `information_schema`.

If the Management API is unavailable, fall back to the Supabase CLI:
```bash
SUPABASE_ACCESS_TOKEN=$(grep ^SUPABASE_ACCESS_TOKEN .env.local | cut -d'=' -f2) \
  /opt/homebrew/bin/supabase db push \
  --db-url "postgresql://postgres:$(grep ^SUPABASE_DB_PASSWORD .env.local | cut -d'=' -f2 | sed 's|/|%2F|g')@db.btkvovgfsrfvikktoyun.supabase.co:5432/postgres"
```

Never edit the database schema directly in the Supabase dashboard — changes made there without a corresponding migration file will be lost and will drift from the codebase.

### Path alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).

### Key utilities

- `src/lib/paceUtils.ts` — pace formatting, duration estimation, schedule date calculation from plan start date
- `src/app/actions/` — all server actions for mutations (paces, plans, workouts, user plans)
- `src/components/` — shared components: Nav, WorkoutCard, WeekGrid, PlanCard, PaceCalculator, WorkoutForm, ThemeProvider
