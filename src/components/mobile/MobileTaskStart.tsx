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
    verify_time_1_min?: number | null;
    verify_time_2_min?: number | null;
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

      // Determine supervisor verification settings (from prop or DB fallback)
      let v1Min = task.verify_time_1_min;
      let v2Min = task.verify_time_2_min;

      if (v1Min === undefined || v2Min === undefined) {
        console.log('MobileTaskStart: verification minutes missing from prop, fetching from DB...');
        const { data: dbTask, error: fetchError } = await supabase
          .from('tasks')
          .select('verify_time_1_min, verify_time_2_min')
          .eq('id', task.id)
          .single();

        if (!fetchError && dbTask) {
          v1Min = dbTask.verify_time_1_min;
          v2Min = dbTask.verify_time_2_min;
        } else if (fetchError) {
          console.error('MobileTaskStart: Error fetching task verification config:', fetchError);
        }
      }

      console.log('MobileTaskStart: Configured minutes for GPS verification:', { v1Min, v2Min });

      let verify_time_1_at: string | null = null;
      let verify_time_2_at: string | null = null;

      let t1Offset = 0;
      if (v1Min != null && v1Min > 0) {
        t1Offset = v1Min * 60 * 1000;
        console.log(`MobileTaskStart: Verification 1 set by supervisor at ${v1Min} minutes.`);
      } else {
        // Trigger randomly between 1 and 3 minutes after task start
        t1Offset = Math.floor(Math.random() * (3 * 60 * 1000 - 1 * 60 * 1000 + 1)) + 1 * 60 * 1000;
        console.log(`MobileTaskStart: Verification 1 will trigger randomly in ${Math.round(t1Offset / 60000 * 10) / 10} minutes.`);
      }
      verify_time_1_at = new Date(new Date(startTime).getTime() + t1Offset).toISOString();

      let t2Offset = 0;
      if (v2Min != null && v2Min > 0) {
        t2Offset = v2Min * 60 * 1000;
        console.log(`MobileTaskStart: Verification 2 set by supervisor at ${v2Min} minutes.`);
      } else {
        // Trigger randomly between 8 and 20 minutes after the first verification
        t2Offset = t1Offset + Math.floor(Math.random() * (20 * 60 * 1000 - 8 * 60 * 1000 + 1)) + 8 * 60 * 1000;
        console.log(`MobileTaskStart: Verification 2 will trigger randomly in ${Math.round((t2Offset - t1Offset) / 60000 * 10) / 10} minutes after first verification.`);
      }
      verify_time_2_at = new Date(new Date(startTime).getTime() + t2Offset).toISOString();

      console.log('MobileTaskStart: Generated target timestamps:', { verify_time_1_at, verify_time_2_at });

      // Update task status and verification trigger times
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ 
          status: 'in_progress',
          verify_time_1_at,
          verify_time_2_at
        })
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
      // Bounce the worker back to the Home screen
      window.dispatchEvent(new CustomEvent('goto-home'));

      onTaskStarted(timeLog.id, photoUrls);
      onClose();
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
