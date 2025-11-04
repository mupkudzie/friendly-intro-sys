# Flask API entry point
from flask import Flask
from .routes import register_routes

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Register all routes
    register_routes(app)
    
    return app

# Initialize services
camera_service = CameraService()
detection_service = DetectionService()
pose_service = PoseService()
db_service = DatabaseService()

def generate_frames():
    """Generate frames from the camera with detections."""
    while True:
        frame = camera_service.get_frame()
        if frame is None:
            continue
        
        # Detect people in the frame
        detections = detection_service.detect_people(frame)
        
        # For each detected person, analyze their pose
        for det in detections:
            x1, y1, x2, y2 = map(int, det['bbox'])
            person_frame = frame[y1:y2, x1:x2]
            
            if person_frame.size > 0:
                activity = pose_service.detect_pose(person_frame)
                if activity:
                    # Log the activity to Supabase
                    db_service.log_detection(
                        worker_id=None,  # TODO: Implement worker identification
                        activity=activity,
                        confidence=det['confidence'],
                        location={'x': x1, 'y': y1}
                    )
        
        # Draw detections on the frame
        frame = detection_service.draw_detections(frame, detections)
        
        # Convert frame to JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    """Video streaming route."""
    return Response(generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/activities/<worker_id>')
def get_worker_activities(worker_id):
    """Get activities for a specific worker."""
    activities = db_service.get_worker_activities(worker_id)
    return jsonify(activities)

if __name__ == '__main__':
    camera_service.start()
    try:
        app.run(host='0.0.0.0', port=5000)
    finally:
        camera_service.stop()