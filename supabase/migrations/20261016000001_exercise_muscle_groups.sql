-- Muscle groups an exercise hits (multi-select from a fixed list).
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS muscle_groups text[] NOT NULL DEFAULT '{}';

ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_muscle_groups_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_muscle_groups_check CHECK (
  muscle_groups <@ ARRAY[
    'chest', 'shoulders', 'back_spine', 'abdomen', 'arms',
    'hips_glutes', 'thighs', 'lower_legs', 'feet'
  ]::text[]
);
