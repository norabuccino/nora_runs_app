-- Exercises can come from more than one source (coach, book, YouTube…):
-- replace the single `source` text column with a `sources` text array.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS sources text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'source'
  ) THEN
    UPDATE exercises
      SET sources = ARRAY[btrim(source)]
      WHERE source IS NOT NULL AND btrim(source) <> '' AND sources = '{}';
    ALTER TABLE exercises DROP COLUMN source;
  END IF;
END $$;
