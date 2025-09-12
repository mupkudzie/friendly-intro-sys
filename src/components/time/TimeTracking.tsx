import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Calendar, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';

interface TimeLog {
  id: string;
  start_time: string;
  end_time: string | null;
  total_hours: number | null;
  break_time: number | null;
  task_id: string;
  user_id: string;
  task?: { title: string; description: string };
  profile?: { full_name: string; role: string };
}

interface TimeTrackingProps {
  userRole: string;
}

export function TimeTracking({ userRole }: TimeTrackingProps) {
  const { userProfile } = useAuth();
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [stats, setStats] = useState({
    totalHours: 0,
    averageHours: 0,
    totalSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeLogs();
  }, [userProfile, userRole]);

  const fetchTimeLogs = async () => {
    if (!userProfile) return;

    let query = supabase
      .from('time_logs')
      .select(`
        *,
        task:tasks(title, description),
        profile:profiles(full_name, role)
      `);

    // Filter based on user role
    if (userRole === 'admin') {
      // Admin sees all time logs
    } else if (userRole === 'supervisor') {
      // Supervisor sees time logs for tasks they assigned
      query = query.eq('task.assigned_by', userProfile.user_id);
    } else {
      // Workers see only their own time logs
      query = query.eq('user_id', userProfile.user_id);
    }

    const { data, error } = await query
      .order('start_time', { ascending: false })
      .limit(50);

    if (!error && data) {
      setTimeLogs(data);
      
      // Calculate stats
      const completedLogs = data.filter(log => log.total_hours);
      const totalHours = completedLogs.reduce((acc, log) => acc + (log.total_hours || 0), 0);
      const totalSessions = completedLogs.length;
      const averageHours = totalSessions > 0 ? totalHours / totalSessions : 0;

      setStats({
        totalHours,
        averageHours,
        totalSessions,
      });
    }
    setLoading(false);
  };

  const getStatusBadge = (log: TimeLog) => {
    if (!log.end_time) {
      return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
    }
    if (log.total_hours) {
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Ended</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading time tracking data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Session</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageHours.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Time Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Time Logs</CardTitle>
          <CardDescription>
            {userRole === 'admin' ? 'All time tracking records' : 
             userRole === 'supervisor' ? 'Time logs for assigned tasks' : 
             'Your time tracking history'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No time logs found
            </div>
          ) : (
            <div className="space-y-4">
              {timeLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{log.task?.title || 'Unknown Task'}</h4>
                      <p className="text-sm text-muted-foreground">{log.task?.description}</p>
                    </div>
                    {getStatusBadge(log)}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {(userRole === 'admin' || userRole === 'supervisor') && log.profile && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{log.profile.full_name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Started: {format(new Date(log.start_time), 'MMM dd, HH:mm')}</span>
                    </div>
                    
                    {log.end_time && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Ended: {format(new Date(log.end_time), 'MMM dd, HH:mm')}</span>
                      </div>
                    )}
                    
                    {log.total_hours && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{log.total_hours}h total</span>
                      </div>
                    )}
                  </div>
                  
                  {log.break_time && log.break_time > 0 && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Break time: {log.break_time}h
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}