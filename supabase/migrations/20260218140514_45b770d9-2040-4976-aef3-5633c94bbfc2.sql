-- Add location_type column to tasks table to distinguish between garden coordinates and current location tasks
ALTER TABLE public.tasks ADD COLUMN location_type text NOT NULL DEFAULT 'garden_coordinates';

-- Add a comment for clarity
COMMENT ON COLUMN public.tasks.location_type IS 'Type of location verification: garden_coordinates (must be at specific coords) or current_location (can work from anywhere)';