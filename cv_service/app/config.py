# Configuration loading utility
import os
import yaml

def load_config():
    """Load configuration based on environment."""
    env = os.getenv('FLASK_ENV', 'development')
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config', f'{env}.yaml')
    
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    return config