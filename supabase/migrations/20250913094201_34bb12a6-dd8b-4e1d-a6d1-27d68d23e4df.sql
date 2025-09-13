-- Add performance evaluations table
CREATE TABLE public.performance_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  supervisor_id uuid NOT NULL,
  score integer NOT NULL CHECK (score >= 1 AND score <= 10),
  feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id uuid NOT NULL,
  sender_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add worker analytics table for tracking weekly/monthly stats
CREATE TABLE public.worker_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid NOT NULL,
  week_start date NOT NULL,
  tasks_completed integer NOT NULL DEFAULT 0,
  hours_accumulated numeric NOT NULL DEFAULT 0,
  productivity_score numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(worker_id, week_start)
);

-- Enable RLS
ALTER TABLE public.performance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_analytics ENABLE ROW LEVEL SECURITY;

-- Performance evaluations policies
CREATE POLICY "Supervisors can create evaluations" 
ON public.performance_evaluations 
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

CREATE POLICY "Users can view their evaluations" 
ON public.performance_evaluations 
FOR SELECT 
USING (
  auth.uid() = worker_id OR 
  auth.uid() = supervisor_id OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role])
);

CREATE POLICY "Supervisors can update evaluations" 
ON public.performance_evaluations 
FOR UPDATE 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

-- Notifications policies
CREATE POLICY "Users can view their notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = recipient_id);

CREATE POLICY "Users can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = recipient_id);

-- Worker analytics policies
CREATE POLICY "Users can view their analytics" 
ON public.worker_analytics 
FOR SELECT 
USING (
  auth.uid() = worker_id OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role])
);

CREATE POLICY "System can insert analytics" 
ON public.worker_analytics 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update analytics" 
ON public.worker_analytics 
FOR UPDATE 
USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_performance_evaluations_updated_at
BEFORE UPDATE ON public.performance_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_analytics_updated_at
BEFORE UPDATE ON public.worker_analytics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically increment hours and check program completion
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  total_hours numeric;
  week_start date;
BEGIN
  -- Only process when task is marked as completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Add 8 hours to time_logs
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for task completion
CREATE TRIGGER on_task_completion
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_completion();

-- Function to send notification when worker has no active tasks
CREATE OR REPLACE FUNCTION public.check_worker_idle()
RETURNS TRIGGER AS $$
DECLARE
  active_tasks_count integer;
  supervisor_id uuid;
BEGIN
  -- Only check when task is approved
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Count active tasks for this worker
    SELECT COUNT(*) INTO active_tasks_count
    FROM public.tasks
    WHERE assigned_to = NEW.assigned_to 
    AND status IN ('pending', 'in_progress');
    
    -- If no active tasks, notify supervisor
    IF active_tasks_count = 0 THEN
      -- Get a supervisor to notify
      SELECT user_id INTO supervisor_id
      FROM public.profiles
      WHERE role = 'supervisor'
      LIMIT 1;
      
      IF supervisor_id IS NOT NULL THEN
        INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
        SELECT supervisor_id, NEW.assigned_to, 'task_request', 'New Task Request', 
               'Worker ' || p.full_name || ' has completed all assigned tasks and is requesting a new assignment.'
        FROM public.profiles p
        WHERE p.user_id = NEW.assigned_to;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for checking idle workers
CREATE TRIGGER on_task_approved
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.check_worker_idle();