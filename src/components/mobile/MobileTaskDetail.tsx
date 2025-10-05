import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskComments } from './TaskComments';
import { MobileTaskStart } from './MobileTaskStart';
import { PhotoCapture } from './PhotoCapture';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string;
  location?: string;
  due_date?: string;
  estimated_hours?: number;
  status: string;
  priority: string;
  geofence_lat?: number;
  geofence_lon?: number;
  geofence_radius?: number;
  instructions?: string;
}

interface MobileTaskDetailProps {
  task: Task;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate: () => void;
}

export function MobileTaskDetail({ task, userId, isOpen, onClose, onTaskUpdate }: MobileTaskDetailProps) {
  const [showStartWorkflow, setShowStartWorkflow] = useState(false);
  const [activeTimeLogId, setActiveTimeLogId] = useState<string | null>(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <PlayCircle className="h-4 w-4" />;
      case 'pending_approval': return <AlertCircle className="h-4 w-4" />;
      case 'approved': return <CheckCircle2 className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleStartTask = () => {
    setShowStartWorkflow(true);
  };

  const handleTaskStarted = (logId: string) => {
    setActiveTimeLogId(logId);
    onTaskUpdate();
  };

  const handleCompleteTask = () => {
    setShowPhotoCapture(true);
  };

  const handlePhotosCapture = async (photos: string[]) => {
    setShowPhotoCapture(false);
    
    try {
      // Update task status to pending_approval
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'pending_approval' })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Store photos in activity_logs
      const { error: activityError } = await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          task_id: task.id,
          status: 'completed',
          final_photos: photos,
          end_time: new Date().toISOString()
        });

      if (activityError) throw activityError;

      // End the time log
      if (activeTimeLogId) {
        const { error: logError } = await supabase
          .from('time_logs')
          .update({ 
            end_time: new Date().toISOString(),
          })
          .eq('id', activeTimeLogId);

        if (logError) throw logError;
      }

      toast({
        title: "Task completed",
        description: "Waiting for supervisor approval. Your supervisor has been notified.",
      });

      onTaskUpdate();
      onClose();
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showStartWorkflow} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getStatusIcon(task.status)}
              {task.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
              <Badge variant="outline">{task.status}</Badge>
            </div>

            <Card className="p-4">
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </Card>

            {task.instructions && (
              <Card className="p-4">
                <h4 className="font-semibold mb-2">Instructions</h4>
                <p className="text-sm text-muted-foreground">{task.instructions}</p>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              {task.location && (
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="text-sm font-medium">{task.location}</p>
                    </div>
                  </div>
                </Card>
              )}

              {task.due_date && (
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="text-sm font-medium">
                        {format(new Date(task.due_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {task.estimated_hours && (
                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Est. Hours</p>
                      <p className="text-sm font-medium">{task.estimated_hours}h</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <TaskComments taskId={task.id} userId={userId} />

            <div className="space-y-2">
              {task.status === 'pending' && (
                <Button onClick={handleStartTask} className="w-full">
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Start Task
                </Button>
              )}

              {task.status === 'in_progress' && (
                <Button onClick={handleCompleteTask} className="w-full">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  End Task
                </Button>
              )}

              {task.status === 'pending_approval' && (
                <Badge variant="outline" className="w-full py-3 justify-center text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pending - Waiting for Supervisor Approval
                </Badge>
              )}

              {task.status === 'approved' && (
                <Badge className="w-full py-3 justify-center text-sm bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Work Done
                </Badge>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showStartWorkflow && (
        <MobileTaskStart
          task={task}
          userId={userId}
          isOpen={showStartWorkflow}
          onClose={() => setShowStartWorkflow(false)}
          onTaskStarted={handleTaskStarted}
        />
      )}

      <Dialog open={showPhotoCapture} onOpenChange={setShowPhotoCapture}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Capture Completion Photos</DialogTitle>
          </DialogHeader>
          <PhotoCapture
            title="Work Completed"
            minPhotos={2}
            maxPhotos={5}
            onPhotosCapture={handlePhotosCapture}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
