import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Play, AlertTriangle, Calendar, MapPin, User, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  estimated_hours: number | null;
  location: string | null;
  instructions: string | null;
  assigned_by: string;
  assigned_to: string;
  created_at: string;
  assignedByProfile?: { full_name: string };
  assignedToProfile?: { full_name: string };
}

interface TaskListProps {
  userRole: string;
}

export function TaskList({ userRole }: TaskListProps) {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [userProfile, userRole]);

  const fetchTasks = async () => {
    if (!userProfile) return;

    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignedByProfile:profiles!assigned_by(full_name),
        assignedToProfile:profiles!assigned_to(full_name)
      `);

    // Filter based on user role
    if (userRole === 'admin') {
      // Admin sees all tasks
    } else if (userRole === 'supervisor') {
      // Supervisor sees tasks they assigned or all tasks
    } else {
      // Workers see only their assigned tasks
      query = query.eq('assigned_to', userProfile.user_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus as 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected' })
      .eq('id', taskId);

    if (!error) {
      if (newStatus === 'completed') {
        // Show message about automatic 8-hour addition
        const { useToast } = await import('@/hooks/use-toast');
        const { toast } = useToast();
        toast({
          title: "Task Completed",
          description: "Task marked as completed! Your supervisor will review it and you'll receive 8 hours upon approval.",
        });
      }
      fetchTasks();
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      approved: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityStyles = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };

    return (
      <Badge variant="outline" className={priorityStyles[priority as keyof typeof priorityStyles]}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Play className="w-4 h-4 text-blue-600" />;
      case 'rejected':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading tasks...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mobile-optimized">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <CheckSquare className="w-5 h-5 text-primary" />
          </div>
          {userRole === 'admin' ? 'All Tasks' : userRole === 'supervisor' ? 'Managed Tasks' : 'My Tasks'}
        </h2>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{tasks.length} tasks</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-xs"
          >
            {showCompleted ? 'Hide Completed' : 'Show Completed'}
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card className="fade-in">
          <CardContent className="p-6 text-center">
            <CheckSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No tasks found</h3>
            <p className="text-muted-foreground">
              {showCompleted ? 'No completed tasks yet.' : 'No active tasks at the moment.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mobile-grid">
          {tasks.map((task) => (
            <Card key={task.id} className="mobile-card slide-up hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      {task.title}
                    </CardTitle>
                    <CardDescription>{task.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {getPriorityBadge(task.priority)}
                    {getStatusBadge(task.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {task.assignedByProfile && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>Assigned by: {task.assignedByProfile.full_name}</span>
                    </div>
                  )}
                  {task.assignedToProfile && userRole !== 'student' && userRole !== 'garden_worker' && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>Assigned to: {task.assignedToProfile.full_name}</span>
                    </div>
                  )}
                  {task.due_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                  {task.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{task.location}</span>
                    </div>
                  )}
                  {task.estimated_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{task.estimated_hours}h estimated</span>
                    </div>
                  )}
                </div>

                {task.instructions && (
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <p className="text-sm">{task.instructions}</p>
                  </div>
                )}

                {/* Action buttons for workers */}
                {(userRole === 'student' || userRole === 'garden_worker') && 
                 task.assigned_to === userProfile?.user_id && (
                  <div className="mt-4 flex gap-2">
                    {task.status === 'pending' && (
                      <Button 
                        size="sm" 
                        onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      >
                        Start Task
                      </Button>
                    )}
                    {task.status === 'in_progress' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                      >
                        Mark Complete
                      </Button>
                    )}
                  </div>
                )}

                {/* Action buttons for supervisors */}
                {userRole === 'supervisor' && task.status === 'completed' && (
                  <div className="mt-4 flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => updateTaskStatus(task.id, 'approved')}
                    >
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateTaskStatus(task.id, 'rejected')}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}