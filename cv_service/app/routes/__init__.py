"""Routes initialization module"""
from .video_routes import video_bp
from .detection_routes import detection_bp
from .health_routes import health_bp

def register_routes(app):
    """Register all blueprints/routes with the app"""
    app.register_blueprint(video_bp)
    app.register_blueprint(detection_bp)
    app.register_blueprint(health_bp)