import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PhotoCapture } from './PhotoCapture';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Clock, CheckCircle2 } from 'lucide-react';

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

export function MobileTaskEnd({ task, userId, timeLogId, isOpen, onClose, onTaskEnded }: MobileTaskEndProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotosCapture = async (photos: string[]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Upload photos to Supabase Storage
      const photoUrls: string[] = [];
      
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
      }

      const endTime = new Date().toISOString();

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

      // Update task status to pending_approval
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'pending_approval' })
        .eq('id', task.id);

      if (taskError) throw taskError;

      toast({
        title: "Task completed!",
        description: "Your work has been submitted for supervisor approval.",
      });

      onTaskEnded();
      onClose();
    } catch (error) {
      console.error('Error ending task:', error);
      toast({
        title: "Error",
        description: "Failed to submit task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Task: {task.title}</DialogTitle>
        </DialogHeader>

        <Card className="p-4 mb-4 bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Clock Out</p>
              <p className="text-sm text-muted-foreground">
                Take photos of your completed work to stop the timer
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

        {isSubmitting && (
          <div className="flex items-center justify-center gap-2 p-4">
            <CheckCircle2 className="h-5 w-5 animate-pulse text-primary" />
            <span className="text-sm text-muted-foreground">Submitting your work...</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
