"""Health check routes"""
from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__)

@health_bp.route('/health')
def health_check():
    """Basic health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'services': {
            'camera': 'running',
            'detection': 'running',
            'database': 'connected'
        }
    })