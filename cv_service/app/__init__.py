from flask import Flask
from .config import load_config

def create_app():
    app = Flask(__name__)
    config = load_config()
    app.config.update(config)
    
    from .routes import register_routes
    register_routes(app)
    
    return app