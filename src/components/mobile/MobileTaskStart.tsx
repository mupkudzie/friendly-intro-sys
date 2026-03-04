import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PhotoCapture } from './PhotoCapture';
import { GeofenceCheck } from './GeofenceCheck';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { refreshCheckInStatus } from './AutoCheckInOut';

interface MobileTaskStartProps {
  task: {
    id: string;
    title: string;
    location?: string;
    geofence_lat?: number;
    geofence_lon?: number;
    geofence_radius?: number;
    location_type?: string;
  };
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskStarted: (logId: string, photos: string[]) => void;
}

type Step = 'location' | 'photos' | 'uploading' | 'complete';

export function MobileTaskStart({ task, userId, isOpen, onClose, onTaskStarted }: MobileTaskStartProps) {
  const isCurrentLocation = task.location_type === 'current_location';
  const [step, setStep] = useState<Step>(isCurrentLocation ? 'photos' : 'location');
  const [initialPhotos, setInitialPhotos] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingMessage, setUploadingMessage] = useState('');

  const handleLocationVerified = (location: { latitude: number; longitude: number }) => {
    setStep('photos');
  };

  const handlePhotosCapture = async (photos: string[]) => {
    setInitialPhotos(photos);
    setStep('uploading');
    setUploadProgress(0);
    
    try {
      // Upload photos to Supabase Storage
      const photoUrls: string[] = [];
      const startTime = new Date().toISOString();
      const totalSteps = photos.length + 3; // photos + time_log + activity_log + task_update
      let currentStep = 0;
      
      setUploadingMessage('Uploading photos...');
      
      for (let i = 0; i < photos.length; i++) {
        const blob = await fetch(photos[i]).then(r => r.blob());
        const fileName = `${userId}/${task.id}/start_${Date.now()}_${i}.jpg`;
        
        const { error } = await supabase.storage
          .from('task-photos')
          .upload(fileName, blob);

        if (error) {
          console.error('Photo upload error:', error);
          throw error;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('task-photos')
          .getPublicUrl(fileName);
          
        photoUrls.push(publicUrl);
        currentStep++;
        setUploadProgress(Math.round((currentStep / totalSteps) * 100));
      }

      setUploadingMessage('Starting clock...');
      
      // Create time log entry - this is the clock in
      const { data: timeLog, error: logError } = await supabase
        .from('time_logs')
        .insert({
          task_id: task.id,
          user_id: userId,
          start_time: startTime,
        })
        .select()
        .single();

      if (logError) {
        console.error('Time log error:', logError);
        throw logError;
      }
      
      currentStep++;
      setUploadProgress(Math.round((currentStep / totalSteps) * 100));
      setUploadingMessage('Saving activity...');

      // Create activity log with initial photos
      const { error: activityError } = await supabase
        .from('activity_logs')
        .insert({
          task_id: task.id,
          user_id: userId,
          start_time: startTime,
          initial_photos: photoUrls,
          status: 'in_progress'
        });

      if (activityError) {
        console.error('Activity log error:', activityError);
        // Don't throw - activity log is supplementary
      }
      
      currentStep++;
      setUploadProgress(Math.round((currentStep / totalSteps) * 100));
      setUploadingMessage('Updating task...');

      // Update task status
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', task.id);

      if (taskError) {
        console.error('Task update error:', taskError);
        throw taskError;
      }
      
      setUploadProgress(100);
      setUploadingMessage('Done!');

      toast({
        title: "Clock In Started!",
        description: "Your time is now being recorded. Take photos when you're done.",
      });

      // Refresh the check-in status display
      refreshCheckInStatus();

      onTaskStarted(timeLog.id, photoUrls);
      onClose();
      
      // Redirect to dashboard after successful photo submission
      window.location.href = '/dashboard';
      
    } catch (error) {
      console.error('Error starting task:', error);
      setStep('photos'); // Go back to photos step
      toast({
        title: "Error",
        description: "Failed to start task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const taskLocation = {
    latitude: task.geofence_lat || 0,
    longitude: task.geofence_lon || 0,
    radius: task.geofence_radius || 100,
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Task: {task.title}</DialogTitle>
        </DialogHeader>

        {step === 'location' && (
          <GeofenceCheck
            taskLocation={taskLocation}
            onLocationVerified={handleLocationVerified}
          />
        )}

        {step === 'photos' && (
          <PhotoCapture
            minPhotos={3}
            maxPhotos={5}
            title="Select Photos Before Starting"
            onPhotosCapture={handlePhotosCapture}
            autoSubmit={false}
          />
        )}

        {step === 'uploading' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <Upload className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Starting Your Task</p>
                <p className="text-sm text-muted-foreground">{uploadingMessage}</p>
              </div>
            </div>
            <Progress value={uploadProgress} className="h-3" />
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{uploadProgress}% complete</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
