import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, X, Clock, User, FileText, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
}

export function TaskApproval() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
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
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        workerProfile:profiles!assigned_to(full_name, role)
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  };

  const handleTaskAction = async (taskId: string, action: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: action })
      .eq('id', taskId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Task ${action} successfully!`,
      });
      fetchCompletedTasks();
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
        <Badge variant="secondary">{tasks.length} tasks</Badge>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-muted-foreground">No completed tasks to review</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
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
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      COMPLETED
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">
                        {task.workerProfile?.full_name} 
                        <span className="text-muted-foreground ml-1">
                          ({task.workerProfile?.role?.replace('_', ' ')})
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">Completed: {format(new Date(task.created_at), 'MMM dd, yyyy')}</span>
                    </div>
                    {task.location && (
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 text-muted-foreground flex-shrink-0">📍</span>
                        <span className="truncate">{task.location}</span>
                      </div>
                    )}
                  </div>

                  {task.instructions && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Instructions:</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md break-words">
                        {task.instructions}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleTaskAction(task.id, 'approved')}
                      className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleTaskAction(task.id, 'rejected')}
                      className="border-red-200 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEditTask(task)}
                          className="flex-1 sm:flex-none"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
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
                              placeholder="Garden section, greenhouse, etc."
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}