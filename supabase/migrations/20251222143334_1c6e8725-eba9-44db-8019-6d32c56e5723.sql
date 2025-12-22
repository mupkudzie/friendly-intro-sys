-- Drop existing restrictive insert policy
DROP POLICY IF EXISTS "Allow role insertion during signup" ON public.user_roles;

-- Create a more permissive insert policy for admins
-- This allows admins (checked via profiles.role) to insert roles for any user
CREATE POLICY "Allow admins to insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) OR 
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'::user_role
  ))
);