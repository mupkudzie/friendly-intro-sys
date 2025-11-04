"""
Setup script to install all dependencies in the correct order
"""
import subprocess
import sys
import os

def run_command(command, description):
    print(f"\n=== {description} ===")
    print(f"Running: {' '.join(command)}")
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        print("Success!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error: {e}")
        print(f"Output: {e.output}")
        return False

def main():
    # Ensure we're in the right directory
    root_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root_dir)
    
    # List of installation steps
    steps = [
        {
            "command": [sys.executable, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"],
            "description": "Upgrading pip, setuptools, and wheel"
        },
        {
            "command": [sys.executable, "-m", "pip", "install", "numpy>=1.26.0"],
            "description": "Installing numpy"
        },
        {
            "command": [sys.executable, "-m", "pip", "install", "opencv-python-headless>=4.8.1"],
            "description": "Installing OpenCV (headless)"
        },
        {
            "command": [sys.executable, "-m", "pip", "install", "torch", "torchvision", "--index-url", "https://download.pytorch.org/whl/cpu"],
            "description": "Installing PyTorch (CPU version)"
        },
        {
            "command": [sys.executable, "-m", "pip", "install", "ultralytics>=8.0.196"],
            "description": "Installing YOLOv5 (ultralytics)"
        },
        {
            "command": [sys.executable, "-m", "pip", "install", "flask>=3.0.0", "python-dotenv>=1.0.0"],
            "description": "Installing Flask and python-dotenv"
        },
        {
            "command": [sys.executable, "-m", "pip", "install", "supabase>=1.0.3"],
            "description": "Installing Supabase client"
        }
    ]
    
    # Run each installation step
    for step in steps:
        if not run_command(step["command"], step["description"]):
            print(f"\nError during: {step['description']}")
            print("Installation failed. Please check the error messages above.")
            sys.exit(1)
    
    print("\n=== Installation completed successfully! ===")
    print("\nYou can now run the application with:")
    print("python run.py")

if __name__ == "__main__":
    main()