ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS verify_time_1_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verify_time_2_at timestamp with time zone;