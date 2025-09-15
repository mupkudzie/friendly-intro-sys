-- Fix security issues

-- Fix notifications table to restrict sender_id
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

-- Fix worker_analytics table to restrict modifications
DROP POLICY IF EXISTS "System can insert analytics" ON public.worker_analytics;
DROP POLICY IF EXISTS "System can update analytics" ON public.worker_analytics;

CREATE POLICY "System and admins can insert analytics" 
ON public.worker_analytics 
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "System and admins can update analytics" 
ON public.worker_analytics 
FOR UPDATE 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- Create task templates table for supervisors
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  estimated_hours NUMERIC,
  priority task_priority NOT NULL DEFAULT 'medium',
  requirements TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS on task templates
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for task templates
CREATE POLICY "Supervisors can create templates" 
ON public.task_templates 
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

CREATE POLICY "Supervisors can update templates" 
ON public.task_templates 
FOR UPDATE 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

CREATE POLICY "All users can view active templates" 
ON public.task_templates 
FOR SELECT 
USING (active = true);

-- Add trigger for task templates updated_at
CREATE TRIGGER update_task_templates_updated_at
BEFORE UPDATE ON public.task_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to send notification when task is requested
CREATE OR REPLACE FUNCTION public.handle_task_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- When a new task request is created, notify supervisors
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
    SELECT p.user_id, NEW.requested_by, 'task_request', 
           'New Task Request: ' || NEW.title, 
           'A new task request has been submitted by ' || requester.full_name || ': ' || NEW.description
    FROM public.profiles p, public.profiles requester
    WHERE p.role = ANY (ARRAY['supervisor'::user_role, 'admin'::user_role])
    AND requester.user_id = NEW.requested_by;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task requests
CREATE TRIGGER on_task_request_created
AFTER INSERT ON public.task_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_request();