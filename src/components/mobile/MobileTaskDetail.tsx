import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { TaskComments } from './TaskComments';
import { MobileTaskStart } from './MobileTaskStart';
import { MobileTaskEnd } from './MobileTaskEnd';
import { LocationReverification } from './LocationReverification';
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
  Loader2,
  RotateCcw
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
  location_type?: string;
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
  const [showEndWorkflow, setShowEndWorkflow] = useState(false);
  const [showRedoRequest, setShowRedoRequest] = useState(false);
  const [redoReason, setRedoReason] = useState('');
  const [submittingRedo, setSubmittingRedo] = useState(false);
  const [activeTimeLogId, setActiveTimeLogId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

  // Fetch active time log when task is in_progress
  useEffect(() => {
    const fetchActiveTimeLog = async () => {
      if (task.status === 'in_progress') {
        const { data } = await supabase
          .from('time_logs')
          .select('id, start_time')
          .eq('task_id', task.id)
          .eq('user_id', userId)
          .is('end_time', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setActiveTimeLogId(data.id);
        }
      }
    };

    fetchActiveTimeLog();
  }, [task.id, task.status, userId]);

  // Timer for elapsed time display
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (task.status === 'in_progress' && activeTimeLogId) {
      const updateElapsedTime = async () => {
        const { data } = await supabase
          .from('time_logs')
          .select('start_time')
          .eq('id', activeTimeLogId)
          .single();

        if (data?.start_time) {
          const start = new Date(data.start_time);
          const now = new Date();
          const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
          
          const hours = Math.floor(diff / 3600);
          const minutes = Math.floor((diff % 3600) / 60);
          const seconds = diff % 60;
          
          setElapsedTime(
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          );
        }
      };

      updateElapsedTime();
      interval = setInterval(updateElapsedTime, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [task.status, activeTimeLogId]);

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
    setShowStartWorkflow(false);
    onTaskUpdate();
  };

  const handleEndTask = () => {
    setShowEndWorkflow(true);
  };

  const handleTaskEnded = () => {
    setShowEndWorkflow(false);
    setActiveTimeLogId(null);
    onTaskUpdate();
    onClose();
  };

  const handleRequestRedo = async () => {
    if (!redoReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the redo request.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingRedo(true);
    try {
      const { error } = await supabase
        .from('task_requests')
        .insert({
          title: task.title,
          description: task.description,
          justification: redoReason.trim(),
          priority: task.priority as 'low' | 'medium' | 'high' | 'urgent',
          requested_by: userId,
          status: 'redo_pending',
        });

      if (error) throw error;

      toast({
        title: "Redo Request Submitted",
        description: "Your request has been sent to the supervisor for approval.",
      });

      setShowRedoRequest(false);
      setRedoReason('');
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingRedo(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showStartWorkflow && !showEndWorkflow && !showRedoRequest} onOpenChange={onClose}>
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

            {/* Show elapsed time when task is in progress */}
            {task.status === 'in_progress' && (
              <Card className="p-4 bg-primary/10 border-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary animate-pulse" />
                    <span className="font-medium">Time Recording</span>
                  </div>
                  <span className="text-2xl font-mono font-bold text-primary">
                    {elapsedTime}
                  </span>
                </div>
              </Card>
            )}

            {/* Random re-verification for garden location tasks */}
            <LocationReverification
              taskId={task.id}
              taskLocation={{
                latitude: task.geofence_lat || 0,
                longitude: task.geofence_lon || 0,
                radius: task.geofence_radius || 100,
              }}
              isTaskActive={task.status === 'in_progress'}
              locationTypeIsGarden={task.location_type !== 'current_location'}
            />

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
                <Button onClick={handleEndTask} className="w-full" variant="default">
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
                <Badge className="w-full py-3 justify-center text-sm bg-primary hover:bg-primary/90 text-primary-foreground">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Work Done
                </Badge>
              )}

              {task.status === 'rejected' && (
                <div className="space-y-2">
                  <Badge variant="destructive" className="w-full py-3 justify-center text-sm">
                    <XCircle className="mr-2 h-4 w-4" />
                    Task Rejected
                  </Badge>
                  <Button onClick={() => setShowRedoRequest(true)} className="w-full" variant="outline">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Request to Redo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Redo Request Dialog */}
      <Dialog open={showRedoRequest} onOpenChange={setShowRedoRequest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Request to Redo Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your previous work was rejected. Please explain why you want to redo this task.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Redo Request *</label>
              <Textarea
                placeholder="Explain what you'll do differently this time..."
                value={redoReason}
                onChange={(e) => setRedoReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowRedoRequest(false)}
                className="flex-1"
                disabled={submittingRedo}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRequestRedo}
                className="flex-1"
                disabled={submittingRedo || !redoReason.trim()}
              >
                {submittingRedo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
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

      {showEndWorkflow && (
        <MobileTaskEnd
          task={task}
          userId={userId}
          timeLogId={activeTimeLogId}
          isOpen={showEndWorkflow}
          onClose={() => setShowEndWorkflow(false)}
          onTaskEnded={handleTaskEnded}
        />
      )}
    </>
  );
}
