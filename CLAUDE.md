# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**nora_runs_app** — helps the user plan marathon training and strength training.

- **Repo:** https://github.com/norabuccino/nora_runs_app
- **Domain:** workouts.norabuccino.com
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

### Stale CSS in local dev
If something styled via a CSS variable in `src/styles/globals.css` (e.g. a new `--badge-*` color) renders blank locally but is fine in production, the Turbopack cache in `.next` is serving an old stylesheet. Stop the dev server, `rm -rf .next`, and restart.

### Dev login button
The login page shows a one-click "⚡ Dev login" button when `NODE_ENV === 'development'` and `NEXT_PUBLIC_DEV_EMAIL` / `NEXT_PUBLIC_DEV_PASSWORD` are set in `.env.local`. The corresponding Supabase account is `admin@local.dev`.

## Architecture

### Supabase client pattern

Three files work together — use the right one for the context:

- `src/lib/supabase/config.ts` — shared URL/key constants (fallback values hardcoded here)
- `src/lib/supabase/client.ts` — browser client, use in `"use client"` components
- `src/lib/supabase/server.ts` — server client, use in Server Components and Route Handlers (async, reads/writes cookies)

### Auth flow

Auth is enforced in `src/middleware.ts`, which runs on every request. It redirects unauthenticated users away from `/dashboard`, `/history`, `/reference`, `/plans`, `/my-plan`, `/paces`, `/workouts`, `/exercises`, and `/admin`, and redirects authenticated users away from `/auth/*` (except `/auth/callback`).

The middleware wraps all Supabase calls in a try/catch — auth failures are logged but never crash the site. Same for `layout.tsx`.

Sign-out is a POST route at `/auth/signout/route.ts` (not a client-side action) to avoid CSRF issues.

### Roles and admin area

`profiles.role` is `"admin" | "user"`. `src/lib/profile.ts` exports `getIsAdmin()` (server-side check), used to gate `/admin/*` routes and server actions in `src/app/actions/admin.ts` (`setUserRole`) and `src/app/actions/badgeColors.ts`. `Nav` shows an "Admin" link only when `isAdmin` is passed in. Admin pages: `/admin/users` (role management), `/admin/badge-colors` (`BadgeColorEditor` — customizes the color/label badges rendered by `WorkoutTypeBadges`), and `/admin/import` (bulk import from plain text, admin-only; server actions in `src/app/actions/adminImport.ts` re-check `getIsAdmin()`):
- **Workouts** (`WorkoutsImport`): workouts separated by `---` lines; each chunk → `parseWorkoutBlock` (`src/lib/workoutTextBlock.ts`: `detectWorkoutType` from a `Type:` line / step style / keywords, then the single-workout parsers) → `buildWorkoutPayload` (steps via `formRowsToStepData`, run totals via `runTotals`) → `adminImportLibraryWorkouts`.
- **Plan** (`PlanImport`): `parsePlanMeta` (name/weeks/type/difficulty/days per week/description/source above the weeks) + `parsePlanText` with `collectBodies` (lines under a day line are that workout written out in full) → `adminImportPlan` creates the plan, then `addPlanWorkoutsFromText`. Day workouts without a body use the same library-or-new choices as the plan editor paste (`PlanWorkoutChoices`).
- **Exercises** (`ExercisesImport`): `parseExerciseList` (`src/lib/exerciseTextImport.ts`; one per line or name + description paragraphs, optional `Type:`/`Equipment:`/`Muscles:`/`Source:`/`Video:` lines; tags/type suggested via `suggestExerciseTags`/`inferExerciseType`); names already in the library are unchecked → `adminImportExercises`.
- Exercise matching for strength workouts is shared with the workout form's paste via `useExerciseResolver`/`ResolvedExerciseRow` (`src/components/ExerciseResolution.tsx`).

### Adding new protected routes

Extend the `isProtectedRoute` check in `src/middleware.ts` to cover any new route prefix that requires authentication.

### Database tables

Fifteen tables exist in Supabase (all with RLS enabled):

| Table | Purpose |
|---|---|
| `training_plans` | Plan templates — `type` is one of: `marathon`, `half_marathon`, `5k_10k`, `base_building`, `strength`, `custom`; also has `difficulty` (beginner/intermediate/advanced), `days_per_week`, and `source`/`source_plan_id` (tracks personal copies of shared plans) |
| `plan_workouts` | Individual workouts within a plan (week + day slots). `type` is one of `run`, `strength`, `rest`, `cross_train`, `bike`, `swim`, `yoga`, `elliptical`; `run_type` covers run variety (easy_run, interval_run, threshold_run, recovery_run, race, long_run, mp_hmp_run); `strength_type` is free text; `day_logic` (`"and"` \| `"or"`) controls whether multiple workouts on the same day/week slot are all required (`and`) or alternatives (`or`); `library_workout_id` links back to the library workout it was copied from |
| `workout_steps` | Ordered segments within a workout (warm-up, interval, cool-down, strength move). FK to exactly one of `plan_workout_id`, `workout_id`, or `scheduled_workout_id` (enforced by CHECK constraint — never set more than one). Also carries strength-specific fields (`sets`, `reps`, `weight_suggestion`, `both_sides`), `exercise_id` (links to the `exercises` library), `video_url`, `repeat_group_id`/`repeat_count`/`group_name` (interval repeat blocks), and `duration_unit`/`distance_unit` |
| `workouts` | Standalone workout library — reusable templates not tied to any plan; user-owned with RLS |
| `scheduled_workouts` | Ad-hoc, date-based workouts (not tied to a plan week/day) — used for one-off workouts scheduled directly onto the dashboard for a specific `scheduled_date`; same field shape as `plan_workouts`/`workouts` plus `completed_at`; steps attach via `workout_steps.scheduled_workout_id` |
| `exercises` | User's exercise library (name, description, `video_url`, `exercise_type`, `sources` text[], `muscle_groups` text[], `equipment` text[], `is_private`) — referenced by `workout_steps.exercise_id` for strength workout steps; private exercises are only visible to their creator. Strength progression metadata: `loading_category` (dashboard grouping), `track_load` (whether it gets weight/reps logging), `load_format` (how to interpret a logged weight — total/per-hand/per-side/etc.), `default_increment` (see [Strength progression](#strength-progression)) |
| `user_plans` | A user's active/past plan assignments with start dates. A user may have one active plan per `training_plans.type` at a time (e.g. one active running plan + one active strength plan simultaneously) |
| `running_paces` | Named paces (Easy, Tempo, etc.) stored as seconds/mile |
| `workout_logs` | Completion records and per-instance workout overrides |
| `profiles` | One row per user; carries `role` (`admin`/`user`) used for admin-gated features |
| `plan_week_notes` | Optional per-week `purpose` text shown on a plan's week view |
| `app_settings` | Admin-managed key/value JSON settings (e.g. `badge_colors`, `badge_layout`); RLS restricts writes to admins |
| `strava_tokens` | OAuth tokens for Strava integration (partially set up) |
| `workout_sessions` | A completed, dated performance of a workout — see [Strength progression](#strength-progression) |
| `workout_session_exercises` | Per-exercise performance within a session, snapshotting the prescription/superset structure at logging time |
| `workout_set_logs` | Per-set actual performance (weight, reps, duration, RPE) |

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

### Plan editor paste import

"Paste plan from text" on `/plans/[id]/edit` opens `PlanTextImportModal`. `parsePlanText` (`src/lib/planTextImport.ts`) reads week headings (`Week 1`, `Weeks 2-4`, `Weeks 1, 3`, `Every week`; lines before any heading use the modal's chosen week), day lines (`Mon:`…`Sun:` with Monday = Day 1 since plans count days from a Monday start, or `Day 3`/`D3`; `Mon/Wed/Fri:` for several), and slots with `a + b` (AND day logic) or `a or b` (OR) — never splitting text that is itself a library title (`isKnownWorkout`). Each distinct workout text is matched to the user's library titles with `matchExercise` (exact → copied like "Add to plan"; else new workout via `workoutFromText`, which guesses type/run type/strength type/distance/time, with "Similar in your library" suggestions, a type select, Pick from library or Skip). `addPlanWorkoutsFromText` (`src/app/actions/planTextImport.ts`) adds them server-side in order (sort order after existing ones) and sets AND logic for `+` slots. Weeks beyond `total_weeks` are skipped with a warning.

### Workout library vs plan workouts

Two separate workout concepts exist:

- **Library workouts** (`workouts` table) — standalone templates owned by the user, managed at `/workouts`. Created/edited via `WorkoutLibraryForm`. Server actions in `src/app/actions/workoutLibrary.ts`.
- **Plan workouts** (`plan_workouts` table) — workouts scheduled to a specific plan week + day. Created/edited via `WorkoutForm`. Server actions in `src/app/actions/workouts.ts`.

When a user clicks "Add to plan" on a library workout, `addLibraryWorkoutToPlan()` **copies** the workout and its steps into `plan_workouts` + `workout_steps`. The copy is independent — editing the library original later does not affect plans that already used it.

### Workout steps

`workout_steps` belongs to exactly one of: a `plan_workout`, a library `workout`, or a `scheduled_workout` — never more than one. The `plan_workout_id`, `workout_id`, and `scheduled_workout_id` columns are all nullable, and a CHECK constraint enforces that exactly one is non-null. When inserting steps, always set only the relevant FK and leave the others null.

### Scheduled workouts (ad-hoc dashboard workouts)

`scheduled_workouts` holds one-off workouts attached directly to a calendar date rather than to a plan's week/day slot — used for workouts logged on the dashboard that don't belong to an active plan. Server actions live in `src/app/actions/scheduledWorkouts.ts` (`createScheduledWorkout`, `createScheduledWorkoutFromLibrary`, `deleteScheduledWorkout`, `markScheduledWorkoutComplete`/`unmarkScheduledWorkoutComplete`). `src/lib/scheduledWorkout.ts` exports `adaptScheduledWorkout()`, which adapts a `ScheduledWorkout` into the `PlanWorkout` shape so it can render through the same `WorkoutCard`/`WeekGrid`/`StrengthWorkoutPlayer` components as real plan workouts; the dashboard (`src/app/dashboard/page.tsx`) and the library's `WorkoutDetailModal` both use it. When no plan is in progress, the dashboard shows a `ScheduledWeekGrid` week planner with ‹ › arrows to page forward to future weeks (never before the current week; heading from `plannerWeekLabel()`).

### Workout history

`/history` (Nav: "History") is a Monday-first month calendar of every workout occurrence — plan workouts placed on dates via their `user_plans.start_date`, plus ad-hoc `scheduled_workouts` — with completed ones filled and missed ones dashed; selecting a day lists its workouts below (still markable done/undone after the fact). The dashboard's `RecentDays` feed shows the days before today (yesterday first, "Show earlier days" extends it a week at a time). Pure merge/calendar logic is in `src/lib/workoutHistory.ts` (`buildHistoryEntries`, `planWeekRange`, `monthGridDates`, `summarizeHistory`); `src/lib/workoutHistoryQuery.ts` (`fetchWorkoutHistory`) does the browser-client fetching. Active plans contribute every workout; paused/completed plans contribute only completed ones. `HistoryDayWorkouts` renders a day's entries for both views. **Backfilling:** "+ Log a past workout" on a selected past day adds an ad-hoc `scheduled_workout` (library or new) already marked done (`completed_at` = `completedAtForDate()`, midday UTC); on today/future days it's a plain "+ Add workout". Ad-hoc entries can be moved to another date (`moveScheduledWorkout`, which also moves their `workout_sessions.session_date`) or deleted from `HistoryDayWorkouts`; plan workouts stay on the date their plan puts them.

### Exercise library

`exercises` is a user-owned library of named exercises (with `video_url`, `exercise_type`, `sources`, `muscle_groups`, `equipment`, `is_private`) managed at `/exercises`. `workout_steps.exercise_id` links a strength step to a library exercise. Server actions in `src/app/actions/exercises.ts`; renaming an exercise (`updateExercise`) propagates the new name to `workout_steps.label` for every step referencing it. `is_private` exercises are only visible to their creator (RLS-enforced) — shared/public exercises are visible to all users.

- **Exercise types** (`EXERCISE_TYPE_LABELS` in `paceUtils.ts`, free text — no DB constraint): `warm_up`, `stretch`, `upper_body`, `lower_body`, `full_body`, `plyos`, `core`, `mobility`. The old `lift` type was split into the three body-region types (Oct 2026); don't reintroduce it.
- **Sources** — `exercises.sources` is a `text[]` (replaced the single `source` column). Helpers in `src/lib/exerciseSources.ts` (`normalizeSources` trims + case-insensitively de-dupes, `parseSources`, `formatSources`, `hasSource`, `collectSources`). The form uses the `SourcesInput` chip input; filters match any of an exercise's sources; CSV import/export puts multiple sources in the `source` column separated by `;`.
- **Muscle groups** — `exercises.muscle_groups` is a `text[]` constrained by a CHECK to `chest`, `shoulders`, `back_spine`, `abdomen`, `arms`, `hips_glutes`, `thighs`, `lower_legs`, `feet`. Labels, canonical head-to-toe order and helpers (`sortMuscleGroups`, `toggleMuscleGroup`, `parseMuscleGroups` — accepts keys or labels, `applyMuscleGroupChange`) live in `src/lib/muscleGroups.ts`. CSV import/export uses a `muscle_groups` column of `;`-separated labels; unknown names fail the import.
- **Equipment** — `exercises.equipment` is a `text[]` of keys from `EQUIPMENT_LABELS` in `src/lib/equipment.ts` (dumbbells, mini band, TRX, box/step, mat, …). Deliberately *not* CHECK-constrained: to add equipment, just add a key there. Empty = bodyweight / not tagged (the "No equipment" filter). Import accepts keys, labels or aliases (`DB`, `box`, `chair`, …) via `parseEquipment`; CSV column `equipment`, `;`-separated. Both muscle groups and equipment are built on the generic `createTagList()` in `src/lib/tagList.ts`.
- **Bulk edit** (select mode on `/exercises`, `bulkUpdateExercises`): set type, *add* a source (never replaces), add/remove one muscle group or piece of equipment, and turn weight tracking on (optionally setting `load_format`) or off (which also clears `load_format`/`default_increment`, mirroring the edit form).
- **Tracked indicator** — exercises with `track_load` show a small accent `↗` icon (tooltip includes the load format) next to the 🔒/▶ icons, and weight tracking is one of the filters.
- **Filter bar** — search, a Filters button (badge = number of active filters) and sort share one row; type pills are a single horizontally-scrolling row on mobile; muscle group, equipment, source, weight tracking and "Missing description" live in a collapsible panel of dropdowns (`filtersOpen`); active filters render as removable chips (`activeFilters`) with Clear all and a result count. Built from the shared `FilterControls` components (see Components) — the Workouts page, the plan editor's `LibraryPickerModal` (via `WorkoutFilterBar`) and the Plans page use the same pattern. Keep new filters in the panel rather than adding more pill rows.
- **Deleting an exercise that's in use** — `handleDelete` first calls `getExerciseUsage()` (workout steps referencing it, grouped per plan/library/scheduled workout via `summarizeExerciseUsage` in `src/lib/exerciseUsage.ts`, plus logged-history count). Unused exercises get a plain confirm; used ones open `DeleteExerciseModal`, which offers to replace it with another library exercise. `deleteExercise(id, { exerciseId, moveHistory })` repoints `workout_steps` (exercise_id, label, and video_url when it was the old exercise's video) and optionally moves `workout_session_exercises` history before deleting.
- **CSV/JSON import & export** (`ExerciseImportModal`) — Export CSV includes `id`, `name` and every editable field except `is_private` (sources, muscle groups and equipment `;`-separated as labels), so export → edit in a spreadsheet → re-import updates in place. Import has two modes:
  - **Create** (no `id` column): every row becomes a new exercise via `importExercises`.
  - **Update existing** (CSV has an `id` column): rows match by `id`, or by an unambiguous case-insensitive name when `id` is blank, and `updateExercisesFromImport` writes only the columns present in the file; **blank cells leave the value unchanged** (so import can't clear a field) and `name` is never written. Parsing/validation (keys *or* labels accepted for type, loading category, load format, muscle groups, equipment) is in `src/lib/exerciseUpdateImport.ts` (`isUpdateImport`, `parseExerciseUpdateRecords`, `matchExerciseUpdates`). Unrecognized columns are ignored, so reference-only columns like `description (reference only)` are safe to include in hand-built files.
  - CSV text is split with `splitCSVRecords` (`src/lib/csvUtils.ts`), which keeps line breaks inside quoted fields and handles CRLF — don't split on `\n`.
- **Create/edit form** — `ExerciseFormFields` (state + payload helpers in `src/lib/exerciseForm.ts`) is the single field set used by both the `/exercises` modal and `ExercisePickerModal`'s "Create new" tab, so they can't drift; add new exercise fields there. Under the muscle group and equipment pickers it offers "Suggested from name" chips (`suggestExerciseTags` in `src/lib/exerciseTagSuggestions.ts`, keyword rules like dumbbell/DB → Dumbbells, glute bridge → Hips & Glutes; equipment also from the description via stricter noun-only rules that skip modification/progression/"for balance" clauses and negations, and read "band around the knees" as a mini band) — click to add, never auto-applied; add a rule there for new keywords. With "Save to exercise library" unchecked the picker shows only name/description/video (`libraryFields={false}`). An unmatched picker search offers to create an exercise with that name.
- **Mobile header** — the Import/Export buttons on `/exercises` and `/workouts` are hidden below the `sm` breakpoint (`hidden sm:inline-block`); nobody imports from a phone and it keeps the header to one line.

### Strength progression

Tracks actual per-set performance (weight/reps/duration) against the canonical `exercise_id`, kept independent of the workout templates' planned prescriptions (`workout_steps.sets`/`reps`/`duration_minutes` are never overwritten). The mental model: **Exercise** (what the movement is) → **Workout** (`workout_steps`, what's planned) → **Workout Session** (`workout_sessions`/`workout_session_exercises`/`workout_set_logs`, what was actually done) → **Progression** (derived from sessions, not separately maintained).

- An exercise only participates in progression tracking when `exercises.track_load` is true; `load_format` (per-hand, per-side, total, bodyweight, etc. — see `LOAD_FORMAT_LABELS` in `paceUtils.ts`) disambiguates what a logged number means, and `loading_category` (`LOADING_CATEGORY_LABELS`) groups it on the dashboard.
- `workout_sessions` ties to exactly one of `plan_workout_id`/`scheduled_workout_id` (CHECK constraint, same pattern as `workout_steps`' three-parent constraint) and snapshots `title`/`workout_type`/`strength_type` so later template edits or deletes don't rewrite history. `workout_session_exercises` similarly snapshots the prescription (`planned_sets`/`planned_reps`/`planned_duration_minutes`) and superset structure (`repeat_group_id`/`repeat_count`/`group_name`) and the exercise's `load_format` at logging time. Only steps with an `exercise_id` get a session-exercise row.
- Server actions in `src/app/actions/strengthSessions.ts`: `getOrCreateWorkoutSession()` is idempotent (reopening "Start Workout" resumes the existing session rather than duplicating it) and re-fetches `workout_steps` server-side rather than trusting client-passed data. `logSet()` upserts one set immediately (not batched). `getLastPerformances()` follows an exercise's most recent performance across every workout it appears in. `getExerciseHistory()` and `getProgressionDashboard()` power the exercise detail history and the `/progression` dashboard respectively.
- Pure display/aggregation logic (unit tested) lives in `src/lib/strengthProgression.ts`: `formatLoad()` turns a number + `load_format` into unambiguous text, `deriveCurrentLoad()` is deliberately simple ("current load" = the last logged set of the most recent completed session — no 1RM/PR estimation), `computeTrend()`, and `computeRecommendation()` (conservative hold/increase/build-reps suggestions — display-only, never writes back to a prescription). The `assisted` load format (counterweight pull-up/dip machines) logs the machine's assistance, so `isAssistedLoad()` flips both: less assistance is an "up" trend and "increase" suggests reducing assistance by `default_increment` (floored at 0); `/progression` shows no trend across a switch to/from assisted, and the player labels the input "Assist (lb)".
- `both_sides` exercises are done and logged one side at a time: `buildSessionBeats()` splits each set/round into a left beat then a right beat, and `workout_set_logs.side` (`left`/`right`, null for ordinary exercises) is part of the set's unique key `(session_exercise_id, set_number, side)`. `formatActualSets()` renders these as `10L 10R / 10L 9R`.
- **Log sets** (`LogSetsModal`, from `PlanWorkoutDetailModal` whenever there's a `sessionDate`) is the after-the-fact alternative to the player: every set as an editable weight/reps/seconds row with a done tick (form logic in `src/lib/setLogForm.ts` — same set numbering as the player, weights carry down to later sets), saved in one call by `saveLoggedSets()` (upserts ticked sets, deletes unticked logged ones, completes the session). Reopening it edits what was logged.
- `StrengthWorkoutPlayer` (see below) is the logging UI — it only persists a session when given a `sessionSource` prop; without one (the read-only plan-template browsing path) it falls back to the original ephemeral, localStorage-only walkthrough.
- `/progression` (Nav: "Progression") is the dashboard — `getProgressionDashboard()` only returns tracked exercises with at least one completed logged session; row click opens the same `ExerciseDetailModal` used on `/exercises`, which shows the strength history table when `track_load` is true. Clicking a session in that history opens an inline editor (`SessionSetsEditor`) to correct its logged weight and reps/seconds per set; `updateLoggedSets()` saves only changed sets (`setLogEdits` in `src/lib/setLogForm.ts`).
- **Muscle group balance** (`MuscleGroupBalance`, top of `/progression`) — completed sets per muscle group with an upper/core/lower split and a 4 week / 12 week / all time range. `getMuscleGroupBreakdown()` gathers logged sessions (sets = distinct logged `set_number`s, falling back to planned sets) plus workouts only marked complete (`workout_logs` / `scheduled_workouts.completed_at`, sets = planned via `buildSessionBeats`, a both-sides set counts once); a marked-complete plan workout is dropped when a logged session for the same `plan_workout_id` is within 7 days (scheduled workouts match by id). An exercise's sets count toward each of its muscle groups; untagged exercises are reported separately. Pure logic (unit tested) in `src/lib/muscleGroupBreakdown.ts`. It doesn't depend on `track_load`.

### WorkoutForm fields

`WorkoutForm` (plan/scheduled context) and `WorkoutLibraryForm` (library context) share the same field set:
- `type` — run | strength | cross_train | rest | bike | swim | yoga | elliptical
- `run_type` — easy_run | interval_run | threshold_run | recovery_run | race | long_run | mp_hmp_run (only shown when type = run)
- `strength_type` — free text, shown when type = strength
- `title`, `description`, `distance_miles`, `pace_type`, `duration_minutes`, `notes`
- `steps[]` — array of `WorkoutStepFormRow` (step_type, label, pace_type, duration_minutes, distance_miles, notes, sets, reps, weight_suggestion, video_url, exercise_id, both_sides)
- `continuous_timers` — boolean, strength only (column on `plan_workouts`/`workouts`/`scheduled_workouts`); when true, `StrengthWorkoutPlayer` auto-advances when a timed exercise/rest ends and auto-starts the next timer, with a full-screen flash announcing the new step
- `equipment_added` / `equipment_removed` — `text[]`, strength only (columns on all three workout tables). A workout's equipment is derived from its exercises' `equipment`, then adjusted by these (`resolveEquipment` in `src/lib/workoutEquipment.ts`), so it keeps tracking exercise changes. `WorkoutEquipmentEditor` edits it in both forms; `WorkoutEquipmentSummary` shows it in `WorkoutDetailModal`/`PlanWorkoutDetailModal`
- `saveToLibrary?` — optional boolean; only present when `WorkoutForm` is opened with `showSaveToLibrary={true}` (plan editor create-new flow)

`WorkoutStepFormRow` is exported from `WorkoutForm.tsx` and imported by `WorkoutLibraryForm.tsx`.

**Type first:** a new workout (both forms) shows only the Type picker (`typeChosen` state, true when editing); the rest of the form appears once a type is picked, starting with a "Paste a workout from text" box for run/swim/strength. Both paste modals run `splitWorkoutText` (`src/lib/workoutTextDetails.ts`) first: labeled lines (`Title:`, `Description:`, `Notes:`, `Source:`, `Type:`/`Focus:`) anywhere, else the first line before the steps is the title and other paragraphs before the steps the description; run/strength type are inferred from those (`inferRunType`, `inferStrengthType`). Details only fill fields that are still empty (`handleTextImport`); a step line is decided by `isExerciseLine` (strength) or `parseRunText` finding a step (run/swim). `ImportedDetailsPreview` shows what was found.

**Paste exercises** (strength only, both forms): `WorkoutTextImportModal` turns pasted text into steps appended to the form. `src/lib/workoutTextImport.ts` is the rule-based parser (`parseWorkoutText` → blocks of single / superset / named group; grammar in the file header: `3x10`, `3 sets, 8-10 reps`, `30s`, `each side`, `@ 20 lb`, `Rest 60s`, `Superset (3 rounds):` / `Circuit x3:` headers, `A1`/`A2` prefixes, other `Name:` headers = named groups) and `toFormSteps` builds `WorkoutStepFormRow`s (rep ranges → low end in `reps`, "8–10 reps" in notes). `src/lib/exerciseMatch.ts` (`matchExercise`) fuzzy-matches names to the library (normalizes case/plurals/abbreviations like DB/KB/SL; exact → matched, else up to 3 suggestions). Unmatched names must be resolved before adding: use a suggestion, create a new exercise (`ExercisePickerModal` with `initialTab="new"` + `initialName`), pick from library, or keep as a one-off step.

**Paste steps** (run and swim, both forms): `RunTextImportModal` + `src/lib/runTextImport.ts` (`parseRunText` → `toRunFormSteps`) read prose like "warm up 2 miles, then 2 sets of 8x200m at 3K pace with 200m recovery. Jog 800m easy between the two sets. 2 mile cooldown". Clauses split on sentences/commas/"then"; roles from warm up/cool down/rest/recovery/jog; repeats `8x200m`, `4 x 5 min`, `with … recovery`; paces matched to the user's `running_paces` names (distance-like names such as Mile/5K only with "at"/"@"/"pace"; aliases MP/HMP/tempo/LT; custom `@ 6:45`), unknown paces go to notes; warm-up/cool-down default to Easy and recoveries to Recovery. Steps can't nest, so "N sets of …" becomes N consecutive repeat groups with any "between sets" step in between (same shape as hand-built workouts). Swim: bare numbers are yards, strokes, `on 1:45` send-offs, `15s rest`. Bike/cross-train/rest have no steps, so no paste.

### Day logic (AND/OR day slots)

`plan_workouts.day_logic` (`"and"` | `"or"`, default `"or"`) governs how multiple workouts scheduled to the same week/day slot relate: `"and"` means all are required that day, `"or"` means they're alternatives (pick one). `CopyToDaysModal` lets a user copy a workout to other day slots within a plan.

### Units (mi/km)

Users can toggle a global mi/km display preference from the nav (`Nav.tsx`). `useUnitPreference()` (`src/hooks/useUnitPreference.ts`) reads/writes `localStorage["unitPref"]` and broadcasts changes via a `window` custom event so every mounted instance of the hook stays in sync on the same page. `src/lib/unitUtils.ts` holds the underlying conversion/formatting functions (`toMiles`, `convertDistance`, `formatPaceForUnit`, `displayDistance`, `getStoredUnit`) — distances are always stored in miles and converted for display only.

### Path alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).

### Key utilities and actions

- `src/lib/paceUtils.ts` — pace formatting, duration estimation, schedule date calculation; exports `RUN_TYPE_LABELS`, `RUN_TYPE_COLORS`, `STEP_TYPE_LABELS`, `WORKOUT_TYPE_LABELS`, `WORKOUT_TYPE_COLORS`, `PLAN_TYPE_LABELS`, `PLAN_TYPE_COLORS`, `EXERCISE_TYPE_LABELS`, `EXERCISE_TYPE_COLORS`, `STRENGTH_TYPE_LABELS`, `STRENGTH_TYPE_COLORS`, `DIFFICULTY_LABELS`, `DIFFICULTY_COLORS`, `DAY_NAMES`, `WEEKDAY_NAMES`
- `src/lib/unitUtils.ts` — mi/km conversion and display formatting (see Units section above)
- `src/lib/profile.ts` — `getIsAdmin()` server-side admin check
- `src/lib/badgeColorUtils.ts` — types/defaults for admin-configurable badge colors and layout
- `src/lib/workoutSteps.ts` — groups a flat step list into standalone steps + repeat/superset groups (`groupSteps`), flattens that into per-set "beats" for the session player (`buildSessionBeats`), plus step duration formatting helpers
- `src/lib/scheduledWorkout.ts` — `adaptScheduledWorkout()` (see Scheduled workouts above)
- `src/lib/strengthProgression.ts` — strength progression display/aggregation logic (see Strength progression above)
- `src/lib/muscleGroups.ts` / `src/lib/equipment.ts` / `src/lib/tagList.ts` / `src/lib/exerciseSources.ts` / `src/lib/exerciseUsage.ts` — exercise muscle groups, equipment (both on the shared tag-list helper), sources, and where-used helpers (see Exercise library above)
- `src/lib/muscleGroupBreakdown.ts` — muscle group balance aggregation (see Strength progression above)
- `src/lib/workoutHistory.ts` / `src/lib/workoutHistoryQuery.ts` — workout history merging + fetching (see Workout history above)
- `src/lib/exerciseUpdateImport.ts` — parsing/matching for the "update existing exercises" CSV import (see Exercise library above)
- `src/lib/csvUtils.ts` — `csvEscape`, `splitCSVLine`, and `splitCSVRecords` (quote-aware record splitting)
- `src/app/actions/workouts.ts` — CRUD for `plan_workouts` + `workout_steps`; also `importWorkouts` for bulk CSV/JSON import
- `src/app/actions/workoutLibrary.ts` — CRUD for `workouts` library + `addLibraryWorkoutToPlan`
- `src/app/actions/scheduledWorkouts.ts` — CRUD for ad-hoc `scheduled_workouts` (see above)
- `src/app/actions/exercises.ts` — CRUD for the `exercises` library, including bulk update, create-import (`importExercises`), update-import (`updateExercisesFromImport`), `getExerciseUsage`, and delete-with-replacement
- `src/app/actions/strengthSessions.ts` — workout session / per-set logging + progression queries, including `getMuscleGroupBreakdown` (see Strength progression above)
- `src/app/actions/plans.ts` — CRUD for `training_plans`
- `src/app/actions/userPlans.ts` — assign plan, mark/unmark workout complete
- `src/app/actions/paces.ts` — CRUD for `running_paces`
- `src/app/actions/admin.ts` — `setUserRole` (admin-only)
- `src/app/actions/badgeColors.ts` — get/save `badge_colors` and `badge_layout` in `app_settings` (admin-only writes)

### Components

| Component | Purpose |
|---|---|
| `Nav` | Top nav with links: Today, History, My Plan, Plans, Workouts, Exercises, Progression, Paces, Reference; shows Admin link when `isAdmin`; includes mi/km toggle and theme toggle. Links collapse into the hamburger menu below `xl` (9 links don't fit at `md`); the email only shows in that menu and the Sign out tooltip |
| `WorkoutForm` | Modal form for creating/editing plan/scheduled workouts (includes run type + steps); accepts `showSaveToLibrary` prop to show "Save to library" checkbox |
| `WorkoutLibraryForm` | Modal form for creating/editing library workouts (same fields, no plan context) |
| `WorkoutCard` | Displays a single plan workout; modes: view / dashboard (with complete button) / edit. Edit mode shows full-width type pill + title only + Edit/Delete at bottom |
| `WorkoutTypeBadges` | Renders the type/run_type/strength_type badge pills for a workout, using admin-configurable colors; `compact` mode shows only the sub-type badge |
| `WorkoutDetailModal` / `PlanWorkoutDetailModal` | Read-only detail view opened by clicking a workout tile; includes treadmill-mode toggle for run workouts and, for strength workouts with steps, a "Start Workout" button that opens `StrengthWorkoutPlayer` |
| `StrengthWorkoutPlayer` | Full-screen session player — steps through sets/exercises/supersets, shows "Last time" performance and weight/reps inputs per set when given a `sessionSource` (see Strength progression above), includes a preset countdown timer for timed holds; supports continuous (auto-advancing) timers via `continuous_timers`; holds a screen wake lock (`useWakeLock`) for the whole session; shows the whole workout (`WorkoutOutline`, built by `buildWorkoutOutline` in `workoutSteps.ts`) as a sidebar on `lg` screens / a ☰ drawer on mobile — done steps crossed out, tap a step to jump to it |
| `HistoryDayWorkouts` / `RecentDays` | One day's workouts from the workout history (complete/undo + detail modal); the dashboard's scroll-back feed of previous days (see Workout history above) |
| `WorkoutImportModal` | File upload modal for bulk-importing workouts from CSV or JSON |
| `AddToPlanModal` | Modal to copy a library workout into a chosen plan + week + day |
| `FilterControls` | Shared compact filter UI: `FiltersButton` (active-count badge), `PillRow`/`Pill` (swipeable primary-type row), `FilterPanel`/`FilterSelect`/`FilterCheckbox` (collapsible dropdown panel), `ActiveFilterChips` (result count + removable chips + Clear all; pass `onClearAll` when filters share one state object). Used by Exercises, Workouts, Plans and `LibraryPickerModal` |
| `WorkoutFilterBar` | Workout type pills + panel (run/strength/cross-train sub-type, source) + chips, built on `FilterControls`; exports `applyWorkoutFilter` and `workoutActiveFilters`. The parent renders the `FiltersButton` and passes `panelOpen` |
| `LibraryPickerModal` | Modal used in the plan editor to pick an existing library workout and copy it into a specific week + day; includes `WorkoutFilterBar` |
| `CopyToDaysModal` | Copies an existing plan workout to other day/week slots in the same plan |
| `WeekGrid` | 7-column week grid; used on plan view, plan edit, and dashboard |
| `PlanWeeklyView` / `MyPlanWeeks` | Render a plan's weeks (workouts + week purpose notes from `plan_week_notes`) |
| `WeekMileageLabel` | Shows a week's mileage range, respecting the mi/km unit preference |
| `PlanCard` | Summary card for a training plan; uses `PLAN_TYPE_COLORS` from paceUtils |
| `ExercisePickerModal` / `ExerciseDetailModal` / `ExerciseImportModal` | Pick/view/bulk-import exercises from the `exercises` library (`ExerciseImportModal` creates new exercises, or updates existing ones when the CSV has an `id` column); `ExerciseDetailModal` also shows muscle groups, equipment, sources, loading metadata + strength history when `track_load` is true, and is reused as-is by `/progression` |
| `DeleteExerciseModal` | Shown when deleting an exercise used in workouts — lists where it's used and offers to replace it with another library exercise (optionally moving its logged history) |
| `SourcesInput` | Chip-style multi-value input for exercise sources (Enter/comma adds, × removes, suggests existing sources) |
| `LoadFormatGuide` / `LoadingCategoryGuide` | Cheat sheets of every load format and loading category (meaning, when to use, examples; text in `src/lib/loadFormatGuide.ts` / `src/lib/loadingCategoryGuide.ts` — add an entry when adding a `LOAD_FORMAT_LABELS` / `LOADING_CATEGORY_LABELS` key, a test enforces it). Shown on `/reference` (Nav: "Reference", a home for reference material) and behind "Which one?" under the exercise form's Loading category / Load format fields |
| `MuscleGroupBalance` | Muscle group balance section on `/progression` (see Strength progression above) |
| `BadgeColorEditor` | Admin UI (`/admin/badge-colors`) for customizing workout/run-type badge colors and layout |
| `PaceCalculator` | Pace calculation utility UI |
| `ThemeProvider` | Dark/light theme context |
