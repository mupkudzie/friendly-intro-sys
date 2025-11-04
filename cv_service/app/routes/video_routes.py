"""Video streaming routes"""
import cv2
import os
from flask import Blueprint, Response, render_template, jsonify, request, send_from_directory
from ..services.camera_service import CameraService
from ..services.detection_service import DetectionService
from ..services.pose_service import PoseService

video_bp = Blueprint('video', __name__)
camera_service = CameraService()
detection_service = DetectionService()
pose_service = PoseService()

@video_bp.route('/')
def index():
    """Render the main dashboard"""
    return render_template('index.html')

def generate_frames():
    """Generate video frames with detections"""
    camera_service.start()
    try:
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
                        # Draw activity label
                        cv2.putText(frame, f"Activity: {activity}",
                                  (x1, y1 - 30), cv2.FONT_HERSHEY_SIMPLEX,
                                  0.6, (0, 255, 0), 2)
            
            # Draw detections on frame
            frame = detection_service.draw_detections(frame, detections)
            
            # Convert frame to JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    finally:
        camera_service.stop()

@video_bp.route('/video_feed')
def video_feed():
    """Video streaming route"""
    return Response(generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')


@video_bp.route('/start_recording', methods=['POST'])
def start_recording():
    """Start recording on the camera. Accepts optional JSON {filename, fps}."""
    data = {}
    if request.is_json:
        data = request.get_json()
    filename = data.get('filename') if data else request.args.get('filename')
    fps = int(data.get('fps')) if data and data.get('fps') else int(request.args.get('fps', 20))

    try:
        path = camera_service.start_recording(filename=filename, fps=fps)
        # Return the basename so frontend can request download
        return jsonify({'status': 'recording', 'file': os.path.basename(path)})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@video_bp.route('/stop_recording', methods=['POST'])
def stop_recording():
    """Stop recording and return the file name."""
    path = camera_service.stop_recording()
    if path:
        return jsonify({'status': 'stopped', 'file': os.path.basename(path)})
    return jsonify({'status': 'not_recording'}), 400


@video_bp.route('/recordings/<path:filename>')
def get_recording(filename):
    """Serve recorded video files."""
    recordings_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'exports', 'recordings'))
    if not os.path.exists(recordings_dir):
        return jsonify({'status': 'error', 'message': 'Recordings directory not found'}), 404
    # Security: ensure the requested file is inside recordings_dir
    safe_path = os.path.abspath(os.path.join(recordings_dir, filename))
    if not safe_path.startswith(recordings_dir):
        return jsonify({'status': 'error', 'message': 'Invalid filename'}), 400
    if not os.path.exists(safe_path):
        return jsonify({'status': 'error', 'message': 'File not found'}), 404
    return send_from_directory(recordings_dir, filename, as_attachment=True)