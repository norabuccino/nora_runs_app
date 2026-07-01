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

After completing any code change, always do all of the following without waiting to be asked:

1. **Run the test suite and update tests as needed:**
   ```bash
   npm run test
   ```
   - If tests fail because the change broke existing behavior, fix the code or update the test to reflect the new intended behavior.
   - If the change adds new logic (new utility functions, new data transforms, new business rules), add tests for it in `src/__tests__/`.
   - Tests must pass before committing.

2. **Commit and push to GitHub:**
   ```bash
   git add <changed files>
   git commit -m "descriptive message"
   git push origin main
   ```

3. **If the change includes a new migration file, apply it immediately** using the Management API (preferred — works when direct DB connections are blocked):
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

Auth is enforced in `src/middleware.ts`, which runs on every request. It redirects unauthenticated users away from `/dashboard`, `/plans`, `/my-plan`, `/paces`, and `/workouts`, and redirects authenticated users away from `/auth/*` (except `/auth/callback`).

The middleware wraps all Supabase calls in a try/catch — auth failures are logged but never crash the site. Same for `layout.tsx`.

Sign-out is a POST route at `/auth/signout/route.ts` (not a client-side action) to avoid CSRF issues.

### Adding new protected routes

Extend the `isProtectedRoute` check in `src/middleware.ts` to cover any new route prefix that requires authentication.

### Database tables

Eight tables exist in Supabase (all with RLS enabled):

| Table | Purpose |
|---|---|
| `training_plans` | Plan templates — type is one of: `marathon`, `half_marathon`, `5k_10k`, `base_building`, `strength`, `custom` |
| `plan_workouts` | Individual workouts within a plan (week + day slots); has `run_type` column for run variety (easy_run, tempo_run, interval_run, threshold_run, recovery_run, race, long_run) |
| `workout_steps` | Ordered segments within a workout (warm-up, interval, cool-down); FK to either `plan_workouts.id` OR `workouts.id` — exactly one must be set (enforced by CHECK constraint) |
| `workouts` | Standalone workout library — reusable templates not tied to any plan; user-owned with RLS |
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

### Plans page

`src/app/plans/page.tsx` is a **client component** (fetches data via the browser Supabase client). It renders filter tabs for each plan type that has at least one plan — tabs only appear when there are plans of more than one type.

### Plan editor add-workout flow

Clicking **+ Add** on a day in the plan editor (`/plans/[id]/edit`) runs a two-step flow:

1. A picker modal asks: **From library** or **Create new**
2. **From library** → `LibraryPickerModal` loads the user's workout library with `WorkoutFilterBar` filters; clicking a row calls `addLibraryWorkoutToPlan()` and closes.
3. **Create new** → `WorkoutForm` opens with `showSaveToLibrary={true}`, which shows a "Save to workout library" checkbox. If checked, the edit page's `handleSave` calls `createLibraryWorkout()` after creating the plan workout.

Clicking **Edit** on an existing workout bypasses the picker and goes directly to `WorkoutForm`.

### Workout library vs plan workouts

Two separate workout concepts exist:

- **Library workouts** (`workouts` table) — standalone templates owned by the user, managed at `/workouts`. Created/edited via `WorkoutLibraryForm`. Server actions in `src/app/actions/workoutLibrary.ts`.
- **Plan workouts** (`plan_workouts` table) — workouts scheduled to a specific plan week + day. Created/edited via `WorkoutForm`. Server actions in `src/app/actions/workouts.ts`.

When a user clicks "Add to plan" on a library workout, `addLibraryWorkoutToPlan()` **copies** the workout and its steps into `plan_workouts` + `workout_steps`. The copy is independent — editing the library original later does not affect plans that already used it.

### Workout steps

`workout_steps` belongs to either a `plan_workout` or a library `workout` — never both. The `plan_workout_id` and `workout_id` columns are both nullable, and a CHECK constraint (`workout_steps_exactly_one_parent`) enforces that exactly one is non-null. When inserting steps, always set only the relevant FK and leave the other null.

### WorkoutForm fields

Both `WorkoutForm` (plan context) and `WorkoutLibraryForm` (library context) share the same field set:
- `type` — run | strength | cross_train | rest
- `run_type` — easy_run | tempo_run | interval_run | threshold_run | recovery_run | race | long_run (only shown when type = run)
- `title`, `description`, `distance_miles`, `pace_type`, `duration_minutes`, `notes`
- `steps[]` — array of `WorkoutStepFormRow` (step_type, label, pace_type, duration_minutes, distance_miles, notes)
- `saveToLibrary?` — optional boolean; only present when `WorkoutForm` is opened with `showSaveToLibrary={true}` (plan editor create-new flow)

`WorkoutStepFormRow` is exported from `WorkoutForm.tsx` and imported by `WorkoutLibraryForm.tsx`.

The step card UI only exposes `step_type`, `pace_type`, `duration_minutes`, and `distance_miles` — `label` and `notes` fields exist in `WorkoutStepFormRow` but are not shown in the form.

### Path alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).

### Key utilities and actions

- `src/lib/paceUtils.ts` — pace formatting, duration estimation, schedule date calculation; exports `RUN_TYPE_LABELS`, `RUN_TYPE_COLORS`, `STEP_TYPE_LABELS`, `WORKOUT_TYPE_LABELS`, `WORKOUT_TYPE_COLORS`, `PLAN_TYPE_LABELS`, `PLAN_TYPE_COLORS`, `DAY_NAMES`
- `src/app/actions/workouts.ts` — CRUD for `plan_workouts` + `workout_steps`; also `importWorkouts` for bulk CSV/JSON import
- `src/app/actions/workoutLibrary.ts` — CRUD for `workouts` library + `addLibraryWorkoutToPlan`
- `src/app/actions/plans.ts` — CRUD for `training_plans`
- `src/app/actions/userPlans.ts` — assign plan, mark/unmark workout complete
- `src/app/actions/paces.ts` — CRUD for `running_paces`

### Components

| Component | Purpose |
|---|---|
| `Nav` | Top nav with links: Today, My Plan, Plans, Workouts, Paces |
| `WorkoutForm` | Modal form for creating/editing plan workouts (includes run type + steps); accepts `showSaveToLibrary` prop to show "Save to library" checkbox |
| `WorkoutLibraryForm` | Modal form for creating/editing library workouts (same fields, no plan context) |
| `WorkoutCard` | Displays a single plan workout; modes: view / dashboard (with complete button) / edit. Edit mode shows full-width type pill + title only + Edit/Delete at bottom |
| `WorkoutImportModal` | File upload modal for bulk-importing workouts from CSV or JSON |
| `AddToPlanModal` | Modal to copy a library workout into a chosen plan + week + day |
| `LibraryPickerModal` | Modal used in the plan editor to pick an existing library workout and copy it into a specific week + day; includes `WorkoutFilterBar` |
| `WeekGrid` | 7-column week grid; used on plan view, plan edit, and dashboard |
| `PlanCard` | Summary card for a training plan; uses `PLAN_TYPE_COLORS` from paceUtils |
| `PaceCalculator` | Pace calculation utility UI |
| `ThemeProvider` | Dark/light theme context |
