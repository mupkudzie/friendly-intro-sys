ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS verify_time_1_min integer,
  ADD COLUMN IF NOT EXISTS verify_time_2_min integer;