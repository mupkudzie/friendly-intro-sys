import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, X, Clock, User, FileText, Edit, Camera, Play, Flag, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ActivityLog {
  id: string;
  task_id: string;
  user_id: string;
  start_time: string | null;
  end_time: string | null;
  initial_photos: string[] | null;
  final_photos: string[] | null;
  status: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  location: string | null;
  instructions: string | null;
  assigned_to: string;
  assigned_by: string;
  created_at: string;
  workerProfile?: { full_name: string; role: string };
  activityLog?: ActivityLog | null;
}

export function TaskApproval() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [feedbackDialog, setFeedbackDialog] = useState<{ taskId: string; action: 'approved' | 'rejected' } | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    location: '',
    instructions: ''
  });

  useEffect(() => {
    fetchCompletedTasks();
  }, []);

  const fetchCompletedTasks = async () => {
    // Fetch tasks with worker profile
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        *,
        workerProfile:profiles!assigned_to(full_name, role)
      `)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      setLoading(false);
      return;
    }

    if (tasksData && tasksData.length > 0) {
      // Fetch activity logs for all pending tasks - get the most recent completed one for each task
      const taskIds = tasksData.map(t => t.id);
      const { data: activityLogs, error: activityError } = await supabase
        .from('activity_logs')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: false });

      if (activityError) {
        console.error('Error fetching activity logs:', activityError);
      }

      // Map activity logs to tasks - find the most recent one for each task (first in sorted list)
      const tasksWithActivity = tasksData.map(task => {
        // Find the most recent activity log for this task (completed or in_progress with final photos)
        const taskLogs = activityLogs?.filter(log => log.task_id === task.id) || [];
        // Prefer completed logs with final_photos, otherwise take the most recent one
        const completedLog = taskLogs.find(log => log.status === 'completed' && log.final_photos);
        const activityLog = completedLog || taskLogs[0] || null;
        
        return {
          ...task,
          activityLog: activityLog ? {
            ...activityLog,
            initial_photos: activityLog.initial_photos as string[] | null,
            final_photos: activityLog.final_photos as string[] | null,
          } : null
        };
      });

      setTasks(tasksWithActivity);
    } else {
      setTasks([]);
    }
    
    setLoading(false);
  };

  const openFeedbackDialog = (taskId: string, action: 'approved' | 'rejected') => {
    setFeedbackDialog({ taskId, action });
    setFeedbackComment('');
  };

  const handleTaskActionWithFeedback = async () => {
    if (!feedbackDialog) return;
    
    const { taskId, action } = feedbackDialog;
    setSubmittingFeedback(true);

    try {
      // Update task status
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: action })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Add feedback comment if provided
      if (feedbackComment.trim()) {
        const { error: commentError } = await supabase
          .from('task_comments')
          .insert({
            task_id: taskId,
            user_id: userProfile?.user_id,
            comment: `[${action === 'approved' ? 'APPROVED' : 'REJECTED'}] ${feedbackComment.trim()}`
          });

        if (commentError) {
          console.error('Error adding feedback comment:', commentError);
        }
      }

      toast({
        title: "Success",
        description: `Task ${action} successfully!${feedbackComment.trim() ? ' Feedback has been recorded.' : ''}`,
      });
      
      setFeedbackDialog(null);
      setFeedbackComment('');
      fetchCompletedTasks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date || '',
      location: task.location || '',
      instructions: task.instructions || ''
    });
  };

  const saveTaskEdit = async () => {
    if (!editingTask) return;

    const { error } = await supabase
      .from('tasks')
      .update({
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: editForm.due_date || null,
        location: editForm.location || null,
        instructions: editForm.instructions || null,
      })
      .eq('id', editingTask.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Task Updated",
        description: "Task has been updated successfully!",
      });
      setEditingTask(null);
      fetchCompletedTasks();
    }
  };

  const getPriorityBadge = (priority: string) => {
    const priorityStyles = {
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
      <Badge variant="outline" className={priorityStyles[priority as keyof typeof priorityStyles]}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const calculateDuration = (startTime: string | null, endTime: string | null) => {
    if (!startTime || !endTime) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMinutes}m`;
  };

  const renderPhotos = (photos: string[] | null, label: string, icon: React.ReactNode) => {
    if (!photos || photos.length === 0) {
      return (
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No {label.toLowerCase()} available</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          <span>{label}</span>
          <Badge variant="secondary" className="text-xs">{photos.length} photo(s)</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {photos.map((photo, index) => (
            <div 
              key={index} 
              className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => setSelectedImage(photo)}
            >
              <img 
                src={photo} 
                alt={`${label} ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading completed tasks...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Task Approval</h2>
        <Badge variant="secondary">{tasks.length} pending approval</Badge>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-muted-foreground">No completed tasks to review</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {tasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                      <FileText className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">{task.title}</span>
                    </CardTitle>
                    <div className="text-sm text-muted-foreground break-words">{task.description}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {getPriorityBadge(task.priority)}
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      PENDING APPROVAL
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-6">
                {/* Worker Info */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Farm Worker Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Name</span>
                      <p className="font-medium">{task.workerProfile?.full_name || 'Unknown'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Play className="w-3 h-3" /> Started
                      </span>
                      <p className="font-medium">
                        {task.activityLog?.start_time 
                          ? format(new Date(task.activityLog.start_time), 'MMM dd, yyyy HH:mm')
                          : 'Not recorded'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Flag className="w-3 h-3" /> Finished
                      </span>
                      <p className="font-medium">
                        {task.activityLog?.end_time 
                          ? format(new Date(task.activityLog.end_time), 'MMM dd, yyyy HH:mm')
                          : 'Not recorded'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Duration
                      </span>
                      <p className="font-medium">
                        {calculateDuration(task.activityLog?.start_time || null, task.activityLog?.end_time || null) || 'N/A'}
                      </p>
                    </div>
                  </div>
                  {task.location && (
                    <div className="flex items-center gap-2 text-sm pt-2 border-t">
                      <span>📍</span>
                      <span className="text-muted-foreground">Location:</span>
                      <span>{task.location}</span>
                    </div>
                  )}
                </div>

                {/* Photo Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Before Photos */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <h4 className="font-medium text-sm">Before Work Photos</h4>
                    </div>
                    {renderPhotos(
                      task.activityLog?.initial_photos || null, 
                      'Before Photos',
                      <Camera className="w-4 h-4 text-blue-500" />
                    )}
                  </div>

                  {/* After Photos */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <h4 className="font-medium text-sm">After Work Photos</h4>
                    </div>
                    {renderPhotos(
                      task.activityLog?.final_photos || null, 
                      'After Photos',
                      <Camera className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>

                {/* Instructions */}
                {task.instructions && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Task Instructions:</h4>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md break-words">
                      {task.instructions}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                  <Button 
                    size="default" 
                    onClick={() => openFeedbackDialog(task.id, 'approved')}
                    className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve Task
                  </Button>
                  <Button 
                    size="default" 
                    variant="outline"
                    onClick={() => openFeedbackDialog(task.id, 'rejected')}
                    className="border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 flex-1 sm:flex-none"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject Task
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        size="default" 
                        variant="outline"
                        onClick={() => handleEditTask(task)}
                        className="flex-1 sm:flex-none"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Task
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Task</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <label htmlFor="title" className="text-sm font-medium">
                            Title
                          </label>
                          <Input
                            id="title"
                            value={editForm.title}
                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <label htmlFor="description" className="text-sm font-medium">
                            Description
                          </label>
                          <Textarea
                            id="description"
                            value={editForm.description}
                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                          />
                        </div>
                        <div className="grid gap-2">
                          <label htmlFor="priority" className="text-sm font-medium">
                            Priority
                          </label>
                          <Select value={editForm.priority} onValueChange={(value) => setEditForm(prev => ({ ...prev, priority: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <label htmlFor="due_date" className="text-sm font-medium">
                            Due Date
                          </label>
                          <Input
                            id="due_date"
                            type="date"
                            value={editForm.due_date}
                            onChange={(e) => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <label htmlFor="location" className="text-sm font-medium">
                            Location
                          </label>
                          <Input
                            id="location"
                            value={editForm.location}
                            onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="Farm section, greenhouse, etc."
                          />
                        </div>
                        <div className="grid gap-2">
                          <label htmlFor="instructions" className="text-sm font-medium">
                            Instructions
                          </label>
                          <Textarea
                            id="instructions"
                            value={editForm.instructions}
                            onChange={(e) => setEditForm(prev => ({ ...prev, instructions: e.target.value }))}
                            rows={3}
                            placeholder="Additional instructions for the worker"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setEditingTask(null)}>
                          Cancel
                        </Button>
                        <Button onClick={saveTaskEdit}>
                          Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
              onClick={() => setSelectedImage(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            {selectedImage && (
              <img 
                src={selectedImage} 
                alt="Full size preview"
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={!!feedbackDialog} onOpenChange={() => setFeedbackDialog(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {feedbackDialog?.action === 'approved' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Approve Task
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-red-600" />
                  Reject Task
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Feedback Comment {feedbackDialog?.action === 'rejected' && <span className="text-red-500">*</span>}
              </label>
              <Textarea
                placeholder={
                  feedbackDialog?.action === 'approved'
                    ? "Add optional feedback for the farm worker..."
                    : "Please explain why this task is being rejected..."
                }
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={4}
                className="resize-none"
              />
              {feedbackDialog?.action === 'rejected' && !feedbackComment.trim() && (
                <p className="text-xs text-destructive">
                  A reason is required when rejecting a task
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setFeedbackDialog(null)}
              disabled={submittingFeedback}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTaskActionWithFeedback}
              disabled={submittingFeedback || (feedbackDialog?.action === 'rejected' && !feedbackComment.trim())}
              className={
                feedbackDialog?.action === 'approved'
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {submittingFeedback ? (
                "Processing..."
              ) : feedbackDialog?.action === 'approved' ? (
                "Approve"
              ) : (
                "Reject"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
