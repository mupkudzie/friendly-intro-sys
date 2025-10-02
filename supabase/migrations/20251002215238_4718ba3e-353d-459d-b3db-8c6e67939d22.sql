-- Create task comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on tasks they're assigned to or created
CREATE POLICY "Users can view comments on their tasks"
ON public.task_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_comments.task_id
    AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid() OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::user_role, 'supervisor'::user_role]))
  )
);

-- Users can create comments on tasks they're assigned to
CREATE POLICY "Users can create comments on their tasks"
ON public.task_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_comments.task_id
    AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid() OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::user_role, 'supervisor'::user_role]))
  )
  AND auth.uid() = user_id
);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
ON public.task_comments
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON public.task_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_task_comments_updated_at_trigger
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION update_task_comments_updated_at();