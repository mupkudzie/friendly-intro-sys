from supabase import create_client
import os
import json
from datetime import datetime

class DatabaseService:
    def __init__(self):
        """Initialize Supabase client."""
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_KEY')
        if not url or not key:
            # Be permissive at init time: don't crash the whole app if env isn't present yet.
            # Log a warning and set client to None. Methods will handle None gracefully.
            print("Warning: Supabase URL and/or key not set. Database operations will be no-ops until configured.")
            self.client = None
        else:
            try:
                self.client = create_client(url, key)
            except Exception as e:
                print(f"Warning: failed to create Supabase client: {e}")
                self.client = None
    
    def log_detection(self, worker_id, activity, confidence, location, image_url=None):
        """Log a worker activity detection."""
        if not self.client:
            print("Database client not configured; skipping log_detection")
            return None

        data = {
            'worker_id': worker_id,
            'activity': activity,
            'confidence': confidence,
            'location': json.dumps(location),
            'image_url': image_url,
            'detected_at': datetime.utcnow().isoformat()
        }
        
        try:
            result = self.client.table('worker_activities').insert(data).execute()
            return result.data
        except Exception as e:
            print(f"Error logging detection: {e}")
            return None
    
    def get_worker_activities(self, worker_id, start_date=None, end_date=None):
        """Get activities for a specific worker."""
        if not self.client:
            print("Database client not configured; get_worker_activities returning empty list")
            return []

        query = self.client.table('worker_activities').select('*')
        if worker_id is not None:
            query = query.eq('worker_id', worker_id)

        if start_date:
            query = query.gte('detected_at', start_date)
        if end_date:
            query = query.lte('detected_at', end_date)

        try:
            result = query.execute()
            return result.data
        except Exception as e:
            print(f"Error fetching worker activities: {e}")
            return []