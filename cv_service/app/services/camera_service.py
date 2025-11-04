import cv2
import threading
import time
from queue import Queue
import os
from datetime import datetime

class CameraService:
    def __init__(self, camera_id=0):
        """Initialize the camera service."""
        self.camera_id = camera_id
        self.cap = None
        self.frame_queue = Queue(maxsize=10)
        self.is_running = False
        self.thread = None
        # Recording state
        self.recording = False
        self.video_writer = None
        self.record_path = None
        self.record_lock = threading.Lock()
    
    def start(self):
        """Start the camera stream."""
        if self.is_running:
            return
        
        self.cap = cv2.VideoCapture(self.camera_id)
        if not self.cap.isOpened():
            raise RuntimeError(f"Failed to open camera {self.camera_id}")
        
        self.is_running = True
        self.thread = threading.Thread(target=self._capture_frames)
        self.thread.daemon = True
        self.thread.start()
    
    def stop(self):
        """Stop the camera stream."""
        self.is_running = False
        if self.thread:
            self.thread.join()
        if self.cap:
            self.cap.release()
    
    def _capture_frames(self):
        """Continuously capture frames from the camera."""
        while self.is_running:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.1)
                continue
            
            # Write frame to recorder if active
            try:
                with self.record_lock:
                    if self.recording and self.video_writer is not None:
                        try:
                            self.video_writer.write(frame)
                        except Exception:
                            # ignore write errors
                            pass
            except Exception:
                pass

            if not self.frame_queue.full():
                self.frame_queue.put(frame)
            else:
                # Remove oldest frame if queue is full
                try:
                    self.frame_queue.get_nowait()
                except:
                    pass
                self.frame_queue.put(frame)
    
    def get_frame(self):
        """Get the latest frame from the camera."""
        if not self.is_running:
            return None
        
        try:
            frame = self.frame_queue.get_nowait()
            return frame
        except:
            return None

    def start_recording(self, filename: str = None, fps: int = 20):
        """Start recording video to file. If filename not provided, create a timestamped file."""
        # Ensure recording directory exists
        recordings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'data', 'exports', 'recordings')
        recordings_dir = os.path.abspath(recordings_dir)
        os.makedirs(recordings_dir, exist_ok=True)

        if filename is None:
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            filename = f'recording_{timestamp}.avi'

        path = os.path.join(recordings_dir, filename)

        # Determine frame size from capture
        if not self.cap or not self.cap.isOpened():
            # Try to start camera if not running
            try:
                self.start()
            except Exception as e:
                raise RuntimeError(f"Cannot start camera for recording: {e}")

        width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
        height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)

        # FourCC and VideoWriter
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        try:
            writer = cv2.VideoWriter(path, fourcc, float(fps), (width, height))
        except Exception as e:
            raise RuntimeError(f"Failed to create video writer: {e}")

        with self.record_lock:
            self.video_writer = writer
            self.recording = True
            self.record_path = path

        return path

    def stop_recording(self):
        """Stop recording and close the file. Returns the recorded file path or None."""
        with self.record_lock:
            if not self.recording:
                return None

            try:
                if self.video_writer is not None:
                    self.video_writer.release()
            except Exception:
                pass
            self.video_writer = None
            self.recording = False
            path = self.record_path
            self.record_path = None

        return path