import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { TaskComments } from './TaskComments';
import { MobileTaskStart } from './MobileTaskStart';
import { MobileTaskEnd } from './MobileTaskEnd';
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
import { cn } from '@/lib/utils';

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
  verify_time_1_min?: number | null;
  verify_time_2_min?: number | null;
  verify_time_1_at?: string | null;
  verify_time_2_at?: string | null;
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
  const [taskStartTime, setTaskStartTime] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

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
          setTaskStartTime(data.start_time);
        }
      }
    };

    fetchActiveTimeLog();
  }, [task.id, task.status, userId]);

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

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': 
        return <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 border-rose-200 uppercase text-[10px] tracking-wider font-extrabold px-2.5 py-0.5 rounded-full">Urgent</Badge>;
      case 'high': 
        return <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50 border-orange-200 uppercase text-[10px] tracking-wider font-extrabold px-2.5 py-0.5 rounded-full">High</Badge>;
      case 'medium': 
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200 uppercase text-[10px] tracking-wider font-extrabold px-2.5 py-0.5 rounded-full">Medium</Badge>;
      case 'low': 
        return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 uppercase text-[10px] tracking-wider font-extrabold px-2.5 py-0.5 rounded-full">Low</Badge>;
      default: 
        return <Badge className="bg-slate-50 text-slate-700 hover:bg-slate-50 border-slate-200 uppercase text-[10px] tracking-wider font-extrabold px-2.5 py-0.5 rounded-full">{priority}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5 text-amber-600" />;
      case 'in_progress': return <PlayCircle className="h-5 w-5 text-blue-600 animate-pulse" />;
      case 'pending_approval': return <AlertCircle className="h-5 w-5 text-purple-600" />;
      case 'approved': return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-rose-600" />;
      default: return <Clock className="h-5 w-5 text-slate-600" />;
    }
  };

  const handleStartTask = () => {
    setShowStartWorkflow(true);
  };

  const handleTaskStarted = (logId: string) => {
    setActiveTimeLogId(logId);
    setShowStartWorkflow(false);
    onTaskUpdate();
    onClose();
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border-0 bg-white shadow-2xl p-6">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-2.5 mb-1.5">
              {getStatusIcon(task.status)}
              <div className="flex gap-2">
                {getPriorityBadge(task.priority)}
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border-slate-200 text-slate-500 font-semibold">{task.status}</Badge>
              </div>
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900 leading-tight font-heading">
              {task.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Elapsed Time Tracker */}
            {task.status === 'in_progress' && (
              <Card className="p-4 bg-gradient-to-br from-slate-900 to-slate-950 text-white border-0 shadow-lg shadow-blue-500/10 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Clock className="h-4.5 w-4.5 text-blue-400 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Elapsed Time</p>
                      <p className="text-xs text-blue-400 font-semibold">Active shift running</p>
                    </div>
                  </div>
                  <span className="text-2xl font-extrabold tracking-wider text-white font-heading">
                    {elapsedTime}
                  </span>
                </div>
              </Card>
            )}

            {/* Description details card */}
            <Card className="p-4 bg-slate-50/50 border-slate-100 rounded-2xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-heading">Description</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">{task.description}</p>
            </Card>

            {/* Instructions card */}
            {task.instructions && (
              <Card className="p-4 bg-slate-50/50 border-slate-100 rounded-2xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-heading">Instructions</h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">{task.instructions}</p>
              </Card>
            )}

            {/* Key parameters cards */}
            <div className="grid grid-cols-3 gap-2">
              {task.location && (
                <Card className="p-2.5 bg-slate-50/30 border-slate-100/80 rounded-xl text-center">
                  <MapPin className="h-4.5 w-4.5 text-slate-400 mx-auto mb-1" />
                  <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Location</p>
                  <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">{task.location}</p>
                </Card>
              )}

              {task.due_date && (
                <Card className="p-2.5 bg-slate-50/30 border-slate-100/80 rounded-xl text-center">
                  <Calendar className="h-4.5 w-4.5 text-slate-400 mx-auto mb-1" />
                  <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Due Date</p>
                  <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">
                    {format(new Date(task.due_date), 'MMM d')}
                  </p>
                </Card>
              )}

              {task.estimated_hours && (
                <Card className="p-2.5 bg-slate-50/30 border-slate-100/80 rounded-xl text-center">
                  <Clock className="h-4.5 w-4.5 text-slate-400 mx-auto mb-1" />
                  <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Est. Hours</p>
                  <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">{task.estimated_hours}h</p>
                </Card>
              )}
            </div>

            {/* Comments log */}
            <TaskComments taskId={task.id} userId={userId} />

            {/* Shift actions */}
            <div className="space-y-2 pt-2">
              {task.status === 'pending' && (
                <Button 
                  onClick={handleStartTask} 
                  className="w-full h-11 rounded-2xl text-xs font-bold gradient-green text-white active-shrink shadow-md shadow-emerald-500/10"
                >
                  <PlayCircle className="mr-2 h-4.5 w-4.5" />
                  Start Operations
                </Button>
              )}

              {task.status === 'in_progress' && (
                <Button 
                  onClick={handleEndTask} 
                  className="w-full h-11 rounded-2xl text-xs font-bold gradient-green text-white active-shrink shadow-md shadow-emerald-500/10"
                >
                  <CheckCircle2 className="mr-2 h-4.5 w-4.5" />
                  Complete Operations
                </Button>
              )}

              {task.status === 'pending_approval' && (
                <Badge variant="outline" className="w-full py-3.5 justify-center rounded-2xl border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                  Awaiting Supervisor Validation
                </Badge>
              )}

              {task.status === 'approved' && (
                <Badge className="w-full py-3.5 justify-center rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold border-0">
                  <CheckCircle2 className="mr-2 h-4.5 w-4.5" />
                  Operations Verified &amp; Approved
                </Badge>
              )}

              {task.status === 'rejected' && (
                <div className="space-y-2">
                  <Badge variant="destructive" className="w-full py-3.5 justify-center rounded-2xl text-xs font-semibold">
                    <XCircle className="mr-2 h-4.5 w-4.5" />
                    Validation Refused by Supervisor
                  </Badge>
                  <Button 
                    onClick={() => setShowRedoRequest(true)} 
                    className="w-full h-11 rounded-2xl text-xs font-bold border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-800" 
                    variant="outline"
                  >
                    <RotateCcw className="mr-2 h-4.5 w-4.5 text-slate-500" />
                    Request Permission to Redo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Redo Request Dialog */}
      <Dialog open={showRedoRequest} onOpenChange={setShowRedoRequest}>
        <DialogContent className="max-w-md rounded-3xl border-0 bg-white shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 font-heading">
              <RotateCcw className="w-5.5 h-5.5 text-primary" />
              Request Task Redo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-xs text-slate-500 leading-relaxed">
              Your previous submissions were rejected. Please justify to your supervisor why you request permission to re-attempt this work.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Reason for Redo Request *</label>
              <Textarea
                placeholder="Explain what steps will be taken to resolve the supervisor's feedback..."
                value={redoReason}
                onChange={(e) => setRedoReason(e.target.value)}
                rows={4}
                className="resize-none rounded-2xl border-slate-200 bg-slate-50/50 focus:ring-primary text-xs"
              />
            </div>
            <div className="flex gap-3.5 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowRedoRequest(false)}
                className="flex-1 h-10.5 rounded-xl border-slate-200 text-slate-600 font-semibold text-xs"
                disabled={submittingRedo}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRequestRedo}
                className="flex-1 h-10.5 rounded-xl gradient-green text-white font-bold text-xs shadow-md shadow-emerald-500/10"
                disabled={submittingRedo || !redoReason.trim()}
              >
                {submittingRedo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
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
