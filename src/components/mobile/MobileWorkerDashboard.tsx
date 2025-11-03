import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileTaskDetail } from './MobileTaskDetail';
import { RequestTask } from '../tasks/RequestTask';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  Plus,
  AlertCircle,
  LogOut
} from 'lucide-react';

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

interface MobileWorkerDashboardProps {
  userId: string;
  userRole: string;
}

export function MobileWorkerDashboard({ userId, userRole }: MobileWorkerDashboardProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    totalHours: 0,
    completedTasks: 0,
    pendingTasks: 0,
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showRequestTask, setShowRequestTask] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [userId]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTasks(data);
    }
  };

  const fetchStats = async () => {
    const { data: timeLogs } = await supabase
      .from('time_logs')
      .select('total_hours')
      .eq('user_id', userId);

    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('assigned_to', userId)
      .eq('status', 'approved');

    const { data: pendingTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('assigned_to', userId)
      .in('status', ['pending', 'in_progress']);

    const totalHours = timeLogs?.reduce((sum, log) => sum + (log.total_hours || 0), 0) || 0;

    setStats({
      totalHours,
      completedTasks: completedTasks?.length || 0,
      pendingTasks: pendingTasks?.length || 0,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500';
      case 'high': return 'border-orange-500';
      case 'medium': return 'border-yellow-500';
      case 'low': return 'border-green-500';
      default: return 'border-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending_approval': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Work</h1>
          <p className="text-sm text-muted-foreground">
            {userRole === 'student' ? 'Student Dashboard' : 'Worker Dashboard'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowRequestTask(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Request Task
          </Button>
          <Button onClick={async () => {
            await signOut();
            navigate('/auth');
          }} size="sm" variant="outline">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex flex-col items-center text-center">
            <Clock className="h-6 w-6 text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.totalHours}</p>
            <p className="text-xs text-muted-foreground">Total Hours</p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="h-6 w-6 text-green-600 mb-2" />
            <p className="text-2xl font-bold">{stats.completedTasks}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex flex-col items-center text-center">
            <TrendingUp className="h-6 w-6 text-blue-600 mb-2" />
            <p className="text-2xl font-bold">{stats.pendingTasks}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">My Tasks</h2>
        {tasks.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No tasks assigned yet</p>
            <Button 
              onClick={() => setShowRequestTask(true)} 
              variant="outline" 
              size="sm"
              className="mt-4"
            >
              Request a Task
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Card 
                key={task.id}
                className={`p-4 border-l-4 ${getPriorityColor(task.priority)} cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{task.title}</h3>
                  <Badge className={getStatusColor(task.status)} variant="outline">
                    {task.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {task.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {task.location && (
                    <span className="flex items-center gap-1">
                      📍 {task.location}
                    </span>
                  )}
                  {task.estimated_hours && (
                    <span className="flex items-center gap-1">
                      ⏱️ {task.estimated_hours}h
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <MobileTaskDetail
          task={selectedTask}
          userId={userId}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdate={() => {
            fetchTasks();
            fetchStats();
          }}
        />
      )}

      <Dialog open={showRequestTask} onOpenChange={setShowRequestTask}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a Task</DialogTitle>
          </DialogHeader>
          <RequestTask />
        </DialogContent>
      </Dialog>
    </div>
  );
}
