import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Clock, User, MapPin, Target } from 'lucide-react';
import { format } from 'date-fns';

interface TaskOverview {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  estimated_hours: number | null;
  location: string | null;
  assigned_to: string | null;
  created_at: string;
  assignedToProfile?: { full_name: string } | null;
}

interface TaskOverviewProps {
  userRole: string;
}

export function TaskOverview({ userRole }: TaskOverviewProps) {
  const { userProfile } = useAuth();
  const [allTasks, setAllTasks] = useState<TaskOverview[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<TaskOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  useEffect(() => {
    if (userProfile) {
      fetchTasks();
    }
  }, [userProfile]);

  const fetchTasks = async () => {
    if (!userProfile) return;

    const query = supabase
      .from('tasks')
      .select(`
        *,
        assignedToProfile:profiles!assigned_to(full_name)
      `);

    // Admin and supervisors see all tasks
    if (userRole === 'admin' || userRole === 'supervisor') {
      const { data, error } = await query
        .or(`due_date.eq.${today},and(created_at.gte.${startOfToday.toISOString()},created_at.lt.${startOfTomorrow.toISOString()})`)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setAllTasks(data);
        setUnassignedTasks(data.filter(task => !task.assigned_to));
      }
    }
    
    setLoading(false);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading task overview...</div>
        </CardContent>
      </Card>
    );
  }

  if (userRole !== 'admin' && userRole !== 'supervisor') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Task overview is only available for supervisors and administrators.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{allTasks.length}</div>
            <div className="text-sm text-muted-foreground">Total Tasks</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {unassignedTasks.length}
            </div>
            <div className="text-sm text-muted-foreground">Unassigned</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <User className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {allTasks.filter(t => t.status === 'in_progress').length}
            </div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Plus className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {allTasks.filter(t => t.status === 'completed').length}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Unassigned Tasks */}
      {unassignedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Unassigned Tasks Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {unassignedTasks.map((task) => (
                <div key={task.id} className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{task.title}</h4>
                    <div className="flex gap-2">
                      {getPriorityBadge(task.priority)}
                      {getStatusBadge(task.status)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {task.description}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    {task.due_date && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Due: {format(new Date(task.due_date), 'MMM dd')}</span>
                      </div>
                    )}
                    {task.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{task.location}</span>
                      </div>
                    )}
                    {task.estimated_hours && (
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        <span>{task.estimated_hours}h estimated</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Tasks Overview */}
      <Card>
        <CardHeader>
          <CardTitle>All Tasks Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {allTasks.map((task) => (
              <div key={task.id} className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{task.title}</h4>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                  <div className="flex gap-2">
                    {getPriorityBadge(task.priority)}
                    {getStatusBadge(task.status)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {task.assignedToProfile ? (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{task.assignedToProfile.full_name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-orange-600">
                      <User className="w-3 h-3" />
                      <span>Unassigned</span>
                    </div>
                  )}
                  
                  {task.due_date && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Due: {format(new Date(task.due_date), 'MMM dd')}</span>
                    </div>
                  )}
                  
                  {task.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{task.location}</span>
                    </div>
                  )}
                  
                  {task.estimated_hours && (
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      <span>{task.estimated_hours}h</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}