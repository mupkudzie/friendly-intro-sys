-- Enable RLS on function_backups table
ALTER TABLE public.function_backups ENABLE ROW LEVEL SECURITY;

-- Enable RLS on worker_activities table  
ALTER TABLE public.worker_activities ENABLE ROW LEVEL SECURITY;

-- Add policies for function_backups (admin only)
CREATE POLICY "Admins can manage function backups"
ON public.function_backups
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add policies for worker_activities
CREATE POLICY "Supervisors and admins can view worker activities"
ON public.worker_activities
FOR SELECT
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

CREATE POLICY "System can insert worker activities"
ON public.worker_activities
FOR INSERT
WITH CHECK (true);