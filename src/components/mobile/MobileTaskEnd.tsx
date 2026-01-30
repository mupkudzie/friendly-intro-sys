import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PhotoCapture } from './PhotoCapture';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Clock, CheckCircle2, Loader2, Upload } from 'lucide-react';

interface MobileTaskEndProps {
  task: {
    id: string;
    title: string;
  };
  userId: string;
  timeLogId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskEnded: () => void;
}

type SubmitStep = 'photos' | 'uploading';

export function MobileTaskEnd({ task, userId, timeLogId, isOpen, onClose, onTaskEnded }: MobileTaskEndProps) {
  const [submitStep, setSubmitStep] = useState<SubmitStep>('photos');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingMessage, setUploadingMessage] = useState('');

  const handlePhotosCapture = async (photos: string[]) => {
    setSubmitStep('uploading');
    setUploadProgress(0);
    
    try {
      // Upload photos to Supabase Storage
      const photoUrls: string[] = [];
      const totalSteps = photos.length + 3; // photos + time_log + activity_log + task_update
      let currentStep = 0;
      
      setUploadingMessage('Uploading photos...');
      
      for (let i = 0; i < photos.length; i++) {
        const blob = await fetch(photos[i]).then(r => r.blob());
        const fileName = `${userId}/${task.id}/end_${Date.now()}_${i}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('task-photos')
          .upload(fileName, blob);

        if (uploadError) {
          console.error('Photo upload error:', uploadError);
          throw uploadError;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('task-photos')
          .getPublicUrl(fileName);
          
        photoUrls.push(publicUrl);
        currentStep++;
        setUploadProgress(Math.round((currentStep / totalSteps) * 100));
      }

      const endTime = new Date().toISOString();
      
      setUploadingMessage('Stopping clock...');

      // End the time log if we have one
      if (timeLogId) {
        const { error: logError } = await supabase
          .from('time_logs')
          .update({ 
            end_time: endTime,
          })
          .eq('id', timeLogId);

        if (logError) {
          console.error('Time log update error:', logError);
          throw logError;
        }
      }
      
      currentStep++;
      setUploadProgress(Math.round((currentStep / totalSteps) * 100));
      setUploadingMessage('Saving activity...');

      // Update the activity log with final photos
      const { error: activityError } = await supabase
        .from('activity_logs')
        .update({
          final_photos: photoUrls,
          end_time: endTime,
          status: 'completed'
        })
        .eq('task_id', task.id)
        .eq('user_id', userId)
        .is('end_time', null);

      if (activityError) {
        console.error('Activity log update error:', activityError);
        // If no existing activity log, create one
        await supabase
          .from('activity_logs')
          .insert({
            user_id: userId,
            task_id: task.id,
            status: 'completed',
            final_photos: photoUrls,
            end_time: endTime
          });
      }
      
      currentStep++;
      setUploadProgress(Math.round((currentStep / totalSteps) * 100));
      setUploadingMessage('Submitting for approval...');

      // Update task status to pending_approval
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'pending_approval' })
        .eq('id', task.id);

      if (taskError) throw taskError;
      
      setUploadProgress(100);
      setUploadingMessage('Done!');

      toast({
        title: "Task completed!",
        description: "Your work has been submitted for supervisor approval.",
      });

      onTaskEnded();
      onClose();
    } catch (error) {
      console.error('Error ending task:', error);
      setSubmitStep('photos'); // Go back to photos step
      toast({
        title: "Error",
        description: "Failed to submit task. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Task: {task.title}</DialogTitle>
        </DialogHeader>

        {submitStep === 'photos' && (
          <>
            <Card className="p-4 mb-4 bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Clock Out</p>
                  <p className="text-sm text-muted-foreground">
                    Select photos of your completed work to stop the timer
                  </p>
                </div>
              </div>
            </Card>

            <PhotoCapture
              minPhotos={3}
              maxPhotos={5}
              title="Completion Photos"
              onPhotosCapture={handlePhotosCapture}
              autoSubmit={false}
            />
          </>
        )}

        {submitStep === 'uploading' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <Upload className="h-6 w-6 text-green-600 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Completing Your Task</p>
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
