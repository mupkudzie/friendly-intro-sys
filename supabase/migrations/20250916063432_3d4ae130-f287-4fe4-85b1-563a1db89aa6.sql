-- Fix security issue: Restrict profiles table access to only show necessary information
-- Drop the current permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create more restrictive policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Supervisors can view worker profiles" 
ON public.profiles 
FOR SELECT 
USING (
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]) 
  OR auth.uid() = user_id
);

-- Fix function search path issues by setting explicit search_path
CREATE OR REPLACE FUNCTION public.handle_task_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

-- Create trigger for task requests if not exists
DROP TRIGGER IF EXISTS task_request_notification_trigger ON public.task_requests;
CREATE TRIGGER task_request_notification_trigger
  AFTER INSERT ON public.task_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_request();

-- Update handle_task_completion function to add 8 hours automatically
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  total_hours numeric;
  week_start date;
BEGIN
  -- Only process when task is marked as completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Add exactly 8 hours to time_logs for any completed task
    INSERT INTO public.time_logs (user_id, task_id, start_time, end_time, total_hours)
    VALUES (NEW.assigned_to, NEW.id, now() - interval '8 hours', now(), 8);
    
    -- Get week start (Monday)
    week_start := date_trunc('week', now())::date;
    
    -- Update worker analytics
    INSERT INTO public.worker_analytics (worker_id, week_start, tasks_completed, hours_accumulated)
    VALUES (NEW.assigned_to, week_start, 1, 8)
    ON CONFLICT (worker_id, week_start)
    DO UPDATE SET 
      tasks_completed = worker_analytics.tasks_completed + 1,
      hours_accumulated = worker_analytics.hours_accumulated + 8,
      updated_at = now();
    
    -- Check total hours for program completion
    SELECT COALESCE(SUM(total_hours), 0) INTO total_hours
    FROM public.time_logs
    WHERE user_id = NEW.assigned_to;
    
    -- If 200+ hours, notify admin
    IF total_hours >= 200 THEN
      INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
      SELECT p.user_id, NEW.assigned_to, 'program_completion', 'Program Completed', 
             'Worker ' || worker.full_name || ' has completed the 200-hour program with ' || total_hours || ' total hours.'
      FROM public.profiles p, public.profiles worker
      WHERE p.role = 'admin' AND worker.user_id = NEW.assigned_to;
    END IF;
    
    -- Create notification for supervisor to review task
    INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
    VALUES (NEW.assigned_by, NEW.assigned_to, 'task_review', 'Task Completed - Review Required', 
            'Task "' || NEW.title || '" has been completed and requires your review.');
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for task completion if not exists
DROP TRIGGER IF EXISTS task_completion_trigger ON public.tasks;
CREATE TRIGGER task_completion_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_completion();

-- Create function to handle task report notifications
CREATE OR REPLACE FUNCTION public.handle_task_report_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- When a new task report is submitted, notify supervisors
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
    SELECT t.assigned_by, NEW.user_id, 'task_report', 
           'New Task Report Submitted', 
           'A task report has been submitted for task: ' || t.title
    FROM public.tasks t
    WHERE t.id = NEW.task_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for task report notifications if not exists
DROP TRIGGER IF EXISTS task_report_notification_trigger ON public.task_reports;
CREATE TRIGGER task_report_notification_trigger
  AFTER INSERT ON public.task_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_report_notification();