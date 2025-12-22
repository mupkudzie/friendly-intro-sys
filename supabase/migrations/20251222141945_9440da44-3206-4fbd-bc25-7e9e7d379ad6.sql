-- Add policy to allow system to insert roles during signup
CREATE POLICY "Allow role insertion during signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow users to have their own role inserted
  auth.uid() = user_id
  OR
  -- Allow admins to insert roles for others
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add policy to allow service role to manage roles (for triggers/functions)
CREATE POLICY "Service role can manage roles"
ON public.user_roles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);