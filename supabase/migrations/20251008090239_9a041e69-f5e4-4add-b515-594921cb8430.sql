-- Update existing tasks with null geofence coordinates to use Bulawayo North Garden location
UPDATE public.tasks 
SET 
  geofence_lat = -20.164235,
  geofence_lon = 28.641425,
  geofence_radius = 100
WHERE geofence_lat IS NULL OR geofence_lon IS NULL;