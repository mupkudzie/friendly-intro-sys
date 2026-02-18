-- Allow users to update their own activity logs (needed for saving final_photos)
CREATE POLICY "Users can update their own activity logs"
ON public.activity_logs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);