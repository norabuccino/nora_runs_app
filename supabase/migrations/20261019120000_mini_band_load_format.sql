-- Mini bands and resistance bands get separate load formats so each can have
-- its own colors. "band" stays as the (long) resistance band; "mini_band" is new.

-- Band exercises tagged with mini band equipment (and not resistance band) become mini band.
UPDATE public.exercises
SET load_format = 'mini_band'
WHERE load_format = 'band'
  AND 'mini_band' = ANY(equipment)
  AND NOT ('resistance_band' = ANY(equipment));

-- Logged sessions snapshot the load format, so move those exercises' snapshots too.
UPDATE public.workout_session_exercises se
SET load_format = 'mini_band'
FROM public.exercises e
WHERE se.exercise_id = e.id
  AND se.load_format = 'band'
  AND e.load_format = 'mini_band';

-- band_colors becomes one level → color map per band kind:
-- { "band": {...}, "mini_band": {...} }. Existing flat maps were set for mini bands.
UPDATE public.user_settings
SET band_colors = jsonb_build_object('mini_band', band_colors)
WHERE band_colors ?| ARRAY['1', '2', '3', '4', '5'];
