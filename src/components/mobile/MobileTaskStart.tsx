import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PhotoCapture } from './PhotoCapture';
import { GeofenceCheck } from './GeofenceCheck';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface MobileTaskStartProps {
  task: {
    id: string;
    title: string;
    location?: string;
    geofence_lat?: number;
    geofence_lon?: number;
    geofence_radius?: number;
  };
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskStarted: (logId: string, photos: string[]) => void;
}

type Step = 'location' | 'photos' | 'complete';

export function MobileTaskStart({ task, userId, isOpen, onClose, onTaskStarted }: MobileTaskStartProps) {
  const [step, setStep] = useState<Step>('location');
  const [verifiedLocation, setVerifiedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [initialPhotos, setInitialPhotos] = useState<string[]>([]);

  const handleLocationVerified = (location: { latitude: number; longitude: number }) => {
    setVerifiedLocation(location);
    setStep('photos');
  };

  const handlePhotosCapture = async (photos: string[]) => {
    setInitialPhotos(photos);
    
    try {
      // Upload photos to Supabase Storage (we'll create this bucket in migration)
      const photoUrls: string[] = [];
      
      for (let i = 0; i < photos.length; i++) {
        const blob = await fetch(photos[i]).then(r => r.blob());
        const fileName = `${userId}/${task.id}/start_${Date.now()}_${i}.jpg`;
        
        const { data, error } = await supabase.storage
          .from('task-photos')
          .upload(fileName, blob);

        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
          .from('task-photos')
          .getPublicUrl(fileName);
          
        photoUrls.push(publicUrl);
      }

      // Create time log entry
      const { data: timeLog, error: logError } = await supabase
        .from('time_logs')
        .insert({
          task_id: task.id,
          user_id: userId,
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (logError) throw logError;

      // Update task status
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', task.id);

      toast({
        title: "Task started",
        description: "Location verified and photos uploaded successfully",
      });

      onTaskStarted(timeLog.id, photoUrls);
      onClose();
      
    } catch (error) {
      console.error('Error starting task:', error);
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
            minPhotos={2}
            maxPhotos={3}
            title="Initial Work Area Photos"
            onPhotosCapture={handlePhotosCapture}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
