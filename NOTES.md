# Notes

Ideas, bugs, and fixes to revisit while testing.

## Features

## Fixes / Bugs
- WorkoutLibraryForm is missing the custom "M:SS" pace entry per step that WorkoutForm has (plan-context workouts can do it, library workouts can't) — the two forms have drifted despite CLAUDE.md documenting them as sharing "the same field set"
- Supabase client is never wired with the `Database` generic (`createBrowserClient<Database>`/`createServerClient<Database>`) — root cause of ~14 `as unknown as X` casts scattered around joined queries; wiring it once would catch column-name typos at compile time
- Bulk operations (`importWorkouts`, the workout-library bulk importer, `updateLibraryWorkout`'s propagate-to-linked-plans loop) do one sequential DB round-trip per row instead of batching — slow for larger imports (a full plan import can be 100+ rows)
- Minor dead code flagged by lint, safe to remove: `switchWorkoutUnit`/`addSection` in `WorkoutForm.tsx`, `switchWorkoutUnit` in `WorkoutLibraryForm.tsx`, unused `paces` prop threaded into `PlanEditDnd`, unused `gridCols` in `WeekGrid.tsx`, redundant `copyWorkoutToDays` import in the plan editor page
- `deletePlan()` in `actions/plans.ts` is fully implemented but never called from any UI — there's currently no way to delete a training plan through the app

## Someday / Maybe
