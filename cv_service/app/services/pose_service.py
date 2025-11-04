import cv2
import numpy as np

class ActivityDetector:
    def __init__(self):
        self.previous_frame = None
        self.motion_threshold = 50  # Adjust this value based on sensitivity needs
        
    def detect_activity(self, frame):
        """Detect activity based on motion analysis."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        if self.previous_frame is None:
            self.previous_frame = gray
            return "standing"
            
        # Calculate frame difference
        frame_diff = cv2.absdiff(self.previous_frame, gray)
        thresh = cv2.threshold(frame_diff, 25, 255, cv2.THRESH_BINARY)[1]
        
        # Update previous frame
        self.previous_frame = gray
        
        # Calculate motion intensity
        motion = np.mean(thresh)
        
        # Classify activity based on motion intensity
        if motion > self.motion_threshold:
            # Additional analysis for activity type
            height, width = thresh.shape
            upper_motion = np.mean(thresh[:height//2])
            lower_motion = np.mean(thresh[height//2:])
            
            if upper_motion > lower_motion * 1.5:
                return "watering"  # More motion in upper body
            elif lower_motion > upper_motion * 1.5:
                return "digging"   # More motion in lower body
            else:
                return "moving"    # General movement
        
        return "standing"

class PoseService:
    def __init__(self):
        """Initialize the activity detector."""
        self.activity_detector = ActivityDetector()
    
    def detect_pose(self, frame):
        """Detect activity in the given frame."""
        return self.activity_detector.detect_activity(frame)
        
    def _basic_motion_detection(self, frame):
        """Basic motion detection using OpenCV."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (21, 21), 0)
        
        # Detect edges
        edges = cv2.Canny(blur, 50, 150)
        
        # If there's significant edge detection, assume movement
        if np.mean(edges) > 10:
            return "movement_detected"
        return "standing"
    
    def _analyze_pose(self, landmarks):
        """Analyze the pose landmarks to determine the activity."""
        # Extract key points for activity recognition
        keypoints = []
        for landmark in landmarks.landmark:
            keypoints.append({
                'x': landmark.x,
                'y': landmark.y,
                'z': landmark.z,
                'visibility': landmark.visibility
            })
        
        # Implement activity recognition logic here
        activity = self._classify_activity(keypoints)
        return activity
    
    def _classify_activity(self, keypoints):
        """Classify the activity based on pose keypoints."""
        # Simple activity classification logic
        # This can be enhanced with ML models for better accuracy
        
        # Example: Check if person is bending (potential digging activity)
        if self._is_bending(keypoints):
            return "digging"
        
        # Check if hands are raised (potential watering activity)
        if self._are_hands_raised(keypoints):
            return "watering"
        
        return "standing"
    
    def _is_bending(self, keypoints):
        """Check if the person is bending."""
        # Get hip and shoulder y-coordinates
        hip_y = keypoints[23].get('y')  # Left hip
        shoulder_y = keypoints[11].get('y')  # Left shoulder
        
        # If hip is higher than shoulder, person is likely bending
        return hip_y and shoulder_y and (hip_y - shoulder_y) < -0.2
    
    def _are_hands_raised(self, keypoints):
        """Check if hands are raised above shoulders."""
        left_wrist_y = keypoints[15].get('y')  # Left wrist
        right_wrist_y = keypoints[16].get('y')  # Right wrist
        shoulder_y = keypoints[11].get('y')  # Left shoulder
        
        return (left_wrist_y and right_wrist_y and shoulder_y and 
                (left_wrist_y < shoulder_y or right_wrist_y < shoulder_y))