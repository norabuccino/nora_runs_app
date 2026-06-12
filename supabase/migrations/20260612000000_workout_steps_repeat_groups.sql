ALTER TABLE workout_steps
  ADD COLUMN IF NOT EXISTS repeat_group_id integer,
  ADD COLUMN IF NOT EXISTS repeat_count integer NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE workout_steps ADD CONSTRAINT repeat_count_positive CHECK (repeat_count >= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
