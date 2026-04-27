
-- Verification logs table
CREATE TABLE public.verification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  verification_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  accuracy NUMERIC,
  distance_from_target NUMERIC,
  expected_latitude NUMERIC,
  expected_longitude NUMERIC,
  expected_radius NUMERIC,
  notes TEXT,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_logs_user_id ON public.verification_logs(user_id);
CREATE INDEX idx_verification_logs_task_id ON public.verification_logs(task_id);
CREATE INDEX idx_verification_logs_created_at ON public.verification_logs(created_at DESC);

ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own verification logs"
ON public.verification_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own verification logs"
ON public.verification_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Supervisors and admins can view all verification logs"
ON public.verification_logs
FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));
