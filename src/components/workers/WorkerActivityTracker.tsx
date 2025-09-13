import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Activity, Clock, User, CheckCircle } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';

interface WorkerActivity {
  user_id: string;
  full_name: string;
  role: string;
  current_task?: {
    id: string;
    title: string;
    start_time: string;
    status: string;
  } | null;
  last_activity: string;
  hours_today: number;
  is_active: boolean;
}

interface WorkerActivityTrackerProps {
  userRole: string;
}

export function WorkerActivityTracker({ userRole }: WorkerActivityTrackerProps) {
  const [workers, setWorkers] = useState<WorkerActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'supervisor') {
      fetchWorkerActivity();
      // Set up real-time updates
      const interval = setInterval(fetchWorkerActivity, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const fetchWorkerActivity = async () => {
    try {
      // Get all workers
      const { data: workersData } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .in('role', ['student', 'garden_worker']);

      if (!workersData) return;

      const workerActivities: WorkerActivity[] = [];

      for (const worker of workersData) {
        // Get current active task
        const { data: currentTask } = await supabase
          .from('tasks')
          .select('id, title, updated_at, status')
          .eq('assigned_to', worker.user_id)
          .eq('status', 'in_progress')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        // Get today's time logs
        const today = new Date().toISOString().split('T')[0];
        const { data: todayLogs } = await supabase
          .from('time_logs')
          .select('start_time, end_time, total_hours')
          .eq('user_id', worker.user_id)
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`);

        // Get last activity (most recent task update or time log)
        const { data: lastActivity } = await supabase
          .from('tasks')
          .select('updated_at')
          .eq('assigned_to', worker.user_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        const hoursToday = todayLogs?.reduce((sum, log) => sum + (log.total_hours || 0), 0) || 0;
        const lastActivityTime = lastActivity?.updated_at || worker.user_id; // Fallback
        const isActive = currentTask ? 
          differenceInHours(new Date(), new Date(currentTask.updated_at)) < 2 : false;

        workerActivities.push({
          user_id: worker.user_id,
          full_name: worker.full_name,
          role: worker.role,
          current_task: currentTask ? {
            id: currentTask.id,
            title: currentTask.title,
            start_time: currentTask.updated_at,
            status: currentTask.status
          } : null,
          last_activity: lastActivityTime,
          hours_today: hoursToday,
          is_active: isActive
        });
      }

      setWorkers(workerActivities);
    } catch (error) {
      console.error('Error fetching worker activity:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading worker activity...</div>
        </CardContent>
      </Card>
    );
  }

  if (userRole !== 'admin' && userRole !== 'supervisor') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Worker activity tracking is only available for supervisors and administrators.
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeWorkers = workers.filter(w => w.is_active);
  const inactiveWorkers = workers.filter(w => !w.is_active);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600">{activeWorkers.length}</div>
            <div className="text-sm text-muted-foreground">Active Workers</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <User className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-600">{inactiveWorkers.length}</div>
            <div className="text-sm text-muted-foreground">Inactive Workers</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-600">
              {workers.reduce((sum, w) => sum + w.hours_today, 0).toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">Hours Today</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Workers */}
      {activeWorkers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Currently Active Workers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {activeWorkers.map((worker) => (
                <div key={worker.user_id} className="p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {worker.full_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">{worker.full_name}</h4>
                        <p className="text-sm text-muted-foreground capitalize">
                          {worker.role.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        <Activity className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                  </div>
                  
                  {worker.current_task && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium text-sm">Current Task</h5>
                          <p className="text-sm text-muted-foreground">
                            {worker.current_task.title}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-medium">
                            {format(new Date(worker.current_task.start_time), 'HH:mm')}
                          </div>
                          <div className="text-muted-foreground">
                            {differenceInHours(new Date(), new Date(worker.current_task.start_time))}h ago
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Hours today:</span>
                    <span className="font-medium">{worker.hours_today.toFixed(1)}h</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Workers Overview */}
      <Card>
        <CardHeader>
          <CardTitle>All Workers Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {workers.map((worker) => (
              <div key={worker.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {worker.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{worker.full_name}</h4>
                    <p className="text-sm text-muted-foreground capitalize">
                      {worker.role.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm font-medium">{worker.hours_today.toFixed(1)}h</div>
                    <div className="text-xs text-muted-foreground">Today</div>
                  </div>
                  
                  <Badge variant={worker.is_active ? "default" : "secondary"}>
                    {worker.is_active ? (
                      <>
                        <Activity className="w-3 h-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}