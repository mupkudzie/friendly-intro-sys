import cv2
import numpy as np

class DetectionService:
    def __init__(self):
        """Initialize the HOG person detector."""
        self.hog = cv2.HOGDescriptor()
        self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        
    def detect_people(self, frame):
        """Detect people in the given frame using HOG detector."""
        # Detect people in the image
        boxes, weights = self.hog.detectMultiScale(
            frame, 
            winStride=(8, 8),
            padding=(4, 4),
            scale=1.05
        )
        
        detections = []
        for (x, y, w, h), confidence in zip(boxes, weights):
            detections.append({
                'bbox': [float(x), float(y), float(x + w), float(y + h)],
                'confidence': float(confidence)
            })
        
        return detections
    
    def draw_detections(self, frame, detections):
        """Draw bounding boxes around detected people."""
        for det in detections:
            x1, y1, x2, y2 = map(int, det['bbox'])
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, f"Person: {det['confidence']:.2f}",
                       (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX,
                       0.5, (0, 255, 0), 2)
        return frame