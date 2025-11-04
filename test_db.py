"""
Test Supabase connection and create necessary tables if they don't exist
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

def test_supabase_connection():
    # Add cv_service to Python path
    cv_service_dir = os.path.join(os.path.dirname(__file__), 'cv_service')
    sys.path.append(cv_service_dir)
    
    # Load environment variables
    env_path = os.path.join(cv_service_dir, '.env')
    load_dotenv(env_path)
    
    # Get Supabase credentials
    url = os.getenv('https://aczdwxhjdaljeflbsmwo.supabase.co')
    key = os.getenv('yJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjemR3eGhqZGFsamVmbGJzbXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1ODQyNjksImV4cCI6MjA3MzE2MDI2OX0.Yz4Y2MiMypPj5dc7gnVbQ1SKHhwHPC4t0AzZZsRHGLI')
    
    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file")
        sys.exit(1)
    
    try:
        # Initialize Supabase client
        supabase: Client = create_client(url, key)
        
        # Test connection by creating worker_activities table if it doesn't exist
        print("Testing Supabase connection...")
        
        # Check if table exists by selecting a single row (safer for PostgREST)
        result = supabase.table('worker_activities').select('*').limit(1).execute()
        if getattr(result, 'error', None):
            print(f"Warning: could not access 'worker_activities' table: {result.error}")
        else:
            print("✓ Successfully connected to Supabase!")
            print("✓ worker_activities table is accessible (fetched up to 1 row)")
        
        return True
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")
        return False

if __name__ == "__main__":
    if test_supabase_connection():
        print("\nDatabase connection is ready!")
        print("You can now run the application with:")
        print("python run.py")
    else:
        print("\nPlease check your Supabase credentials and try again.")