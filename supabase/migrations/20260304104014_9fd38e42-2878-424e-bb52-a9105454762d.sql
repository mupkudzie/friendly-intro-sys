-- Allow supervisors/admins to delete templates
CREATE POLICY "Supervisors can delete templates"
ON public.task_templates
FOR DELETE
TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

-- Fix handle_task_completion to use actual time_log hours instead of fixed 8h
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_hours_val numeric;
  week_start_date date;
  actual_hours numeric;
BEGIN
  IF NEW.status = 'pending_approval' AND OLD.status != 'pending_approval' THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
    VALUES (NEW.assigned_by, NEW.assigned_to, 'task_review', 'Task Completed - Review Required', 
            'Task "' || NEW.title || '" has been completed by the student and requires your review.');
  END IF;
  
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    SELECT COALESCE(
      ROUND((EXTRACT(EPOCH FROM (tl.end_time - tl.start_time)) / 3600.0 - COALESCE(tl.break_time, 0))::numeric, 2),
      0
    ) INTO actual_hours
    FROM public.time_logs tl
    WHERE tl.task_id = NEW.id AND tl.user_id = NEW.assigned_to AND tl.end_time IS NOT NULL
    ORDER BY tl.created_at DESC
    LIMIT 1;

    IF actual_hours IS NULL OR actual_hours < 0 THEN
      actual_hours := 0;
    END IF;

    UPDATE public.time_logs
    SET total_hours = actual_hours
    WHERE task_id = NEW.id AND user_id = NEW.assigned_to AND end_time IS NOT NULL
    AND total_hours IS NULL;
    
    week_start_date := date_trunc('week', now())::date;
    
    INSERT INTO public.worker_analytics (worker_id, week_start, tasks_completed, hours_accumulated)
    VALUES (NEW.assigned_to, week_start_date, 1, actual_hours)
    ON CONFLICT (worker_id, week_start)
    DO UPDATE SET 
      tasks_completed = worker_analytics.tasks_completed + 1,
      hours_accumulated = worker_analytics.hours_accumulated + actual_hours,
      updated_at = now();
    
    SELECT COALESCE(SUM(time_logs.total_hours), 0) INTO total_hours_val
    FROM public.time_logs
    WHERE user_id = NEW.assigned_to;
    
    IF total_hours_val >= 200 THEN
      INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
      SELECT p.user_id, NEW.assigned_to, 'program_completion', 'Program Completed', 
             'Worker ' || worker.full_name || ' has completed the 200-hour program with ' || total_hours_val || ' total hours.'
      FROM public.profiles p, public.profiles worker
      WHERE p.role = 'admin' AND worker.user_id = NEW.assigned_to;
    END IF;
    
    INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
    VALUES (NEW.assigned_to, NEW.assigned_by, 'task_approved', 'Task Approved!', 
            'Your task "' || NEW.title || '" has been approved. ' || actual_hours || ' hours have been added to your time log.');
  END IF;
  
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    INSERT INTO public.notifications (recipient_id, sender_id, type, title, message)
    VALUES (NEW.assigned_to, NEW.assigned_by, 'task_rejected', 'Task Requires Rework', 
            'Your task "' || NEW.title || '" needs to be reworked. Please review the feedback and resubmit.');
  END IF;
  
  RETURN NEW;
END;
$function$;