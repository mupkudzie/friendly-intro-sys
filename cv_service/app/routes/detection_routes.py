"""Detection and activity routes"""
from flask import Blueprint, jsonify
from ..services.database_service import DatabaseService

detection_bp = Blueprint('detection', __name__)
db_service = DatabaseService()

@detection_bp.route('/activities/recent')
def get_recent_activities():
    """Get recent activities"""
    activities = db_service.get_worker_activities(None)  # None means all workers
    return jsonify(activities)

@detection_bp.route('/activities/<worker_id>')
def get_worker_activities(worker_id):
    """Get activities for a specific worker"""
    activities = db_service.get_worker_activities(worker_id)
    return jsonify(activities)