-- Create activity_logs table for mobile sensor tracking
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  initial_photos jsonb,
  final_photos jsonb,
  activity_data_json jsonb,
  status text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activity logs"
  ON public.activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Supervisors and admins can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

-- Create storage bucket for task photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-photos',
  'task-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Users can upload their own task photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'task-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view task photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'task-photos');

-- Add geofence columns to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS geofence_lat numeric,
ADD COLUMN IF NOT EXISTS geofence_lon numeric,
ADD COLUMN IF NOT EXISTS geofence_radius numeric DEFAULT 100;

-- Create trigger for updated_at
CREATE TRIGGER update_activity_logs_updated_at
  BEFORE UPDATE ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();