-- Fix security issue: Set proper search_path for the function
CREATE OR REPLACE FUNCTION update_task_comments_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;