-- Allow supervisors and admins to delete tasks
CREATE POLICY "Supervisors and admins can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));