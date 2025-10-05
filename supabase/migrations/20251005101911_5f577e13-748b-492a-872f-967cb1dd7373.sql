-- Fix RLS policy to allow students to complete tasks
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Supervisors and admins can update tasks" ON public.tasks;

-- Create new policies with proper permissions
-- Supervisors and admins can update any task
CREATE POLICY "Supervisors and admins can update tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]))
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

-- Students can update their assigned tasks from pending to in_progress
CREATE POLICY "Students can start their tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  auth.uid() = assigned_to 
  AND status = 'pending'::task_status
)
WITH CHECK (
  auth.uid() = assigned_to 
  AND status = 'in_progress'::task_status
);

-- Students can update their assigned tasks from in_progress to pending_approval
CREATE POLICY "Students can complete their tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  auth.uid() = assigned_to 
  AND status = 'in_progress'::task_status
)
WITH CHECK (
  auth.uid() = assigned_to 
  AND status = 'pending_approval'::task_status
);