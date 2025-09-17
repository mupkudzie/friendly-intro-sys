-- Add pending_approval status to task_status enum
ALTER TYPE task_status ADD VALUE 'pending_approval';

-- Create task_history table for tracking task progress
CREATE TABLE public.task_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  old_status task_status,
  new_status task_status,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on task_history
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_history
CREATE POLICY "Users can view task history for their tasks" 
ON public.task_history 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = task_history.task_id 
    AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid() OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]))
  )
);

CREATE POLICY "System can insert task history" 
ON public.task_history 
FOR INSERT 
WITH CHECK (true);

-- Create function to log task status changes
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_history (task_id, user_id, action, old_status, new_status)
    VALUES (
      NEW.id,
      auth.uid(),
      CASE 
        WHEN NEW.status = 'pending_approval' THEN 'Work completed by student'
        WHEN NEW.status = 'approved' THEN 'Task approved by supervisor'
        WHEN NEW.status = 'rejected' THEN 'Task rejected by supervisor'
        WHEN NEW.status = 'in_progress' THEN 'Task started or returned for rework'
        ELSE 'Status changed'
      END,
      OLD.status,
      NEW.status
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task status changes
CREATE TRIGGER task_status_change_log
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_status_change();

-- Update the task completion function to use pending_approval
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_hours numeric;
  week_start date;
BEGIN
  -- When task is marked as pending_approval (student completed work)
  IF NEW.status = 'pending_approval' AND OLD.status != 'pending_approval' THEN
    -- Create notification for supervisor to review task
    INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
    VALUES (NEW.assigned_by, NEW.assigned_to, 'task_review', 'Task Completed - Review Required', 
            'Task "' || NEW.title || '" has been completed by the student and requires your review.');
  END IF;
  
  -- Only add hours and analytics when task is approved (not just completed)
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Add exactly 8 hours to time_logs for approved task
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
    
    -- Notify student of approval
    INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
    VALUES (NEW.assigned_to, NEW.assigned_by, 'task_approved', 'Task Approved!', 
            'Your task "' || NEW.title || '" has been approved. 8 hours have been added to your time log.');
  END IF;
  
  -- When task is rejected, notify student
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
    VALUES (NEW.assigned_to, NEW.assigned_by, 'task_rejected', 'Task Requires Rework', 
            'Your task "' || NEW.title || '" needs to be reworked. Please review the feedback and resubmit.');
  END IF;
  
  RETURN NEW;
END;
$$;