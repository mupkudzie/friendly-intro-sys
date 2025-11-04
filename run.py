"""
Root level runner for the CV service
"""
import os
import sys

def main():
    # Add cv_service directory to Python path
    cv_service_dir = os.path.join(os.path.dirname(__file__), 'cv_service')
    sys.path.append(cv_service_dir)
    
    # Change to cv_service directory
    os.chdir(cv_service_dir)
    # Load environment variables from .env (if present)
    try:
        from dotenv import load_dotenv
        dotenv_path = os.path.join(cv_service_dir, '.env')
        if os.path.exists(dotenv_path):
            load_dotenv(dotenv_path)
            print(f"Loaded environment from {dotenv_path}")
    except Exception:
        # If python-dotenv isn't installed or load fails, continue and rely on real env vars
        pass

    # Import and run the app
    try:
        from app import create_app
        app = create_app()
        app.run(host='0.0.0.0', port=5000)
    except ImportError as e:
        print("Error: Failed to import required modules.")
        print(f"Make sure you've installed all requirements: {e}")
        print("\nTry running:")
        print("python -m pip install -r cv_service/requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"Error starting the application: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()