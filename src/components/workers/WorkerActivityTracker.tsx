import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Activity, Clock, User, AlertTriangle, LogIn, LogOut, MapPinOff } from 'lucide-react';
import { format } from 'date-fns';

interface WorkerActivity {
  user_id: string;
  full_name: string;
  role: string;
  clock_in?: string | null;
  clock_out?: string | null;
  hours_today: number;
  current_task_title?: string | null;
  is_active: boolean;
}

interface VerificationIssue {
  id: string;
  user_id: string;
  worker_name: string;
  task_id: string;
  status: string;
  triggered_at: string;
  distance_from_target: number | null;
}

interface WorkerActivityTrackerProps {
  userRole: string;
}

export function WorkerActivityTracker({ userRole }: WorkerActivityTrackerProps) {
  const [workers, setWorkers] = useState<WorkerActivity[]>([]);
  const [issues, setIssues] = useState<VerificationIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'supervisor') {
      fetchAll();
      const interval = setInterval(fetchAll, 30000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const fetchAll = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;

      const { data: workersData } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .in('role', ['student', 'garden_worker'])
        .eq('is_deleted', false);

      if (!workersData) return;
      const userIds = workersData.map(w => w.user_id);
      const nameMap = new Map(workersData.map(w => [w.user_id, w.full_name]));

      const [logsRes, tasksRes, verifRes] = await Promise.all([
        supabase
          .from('time_logs')
          .select('user_id, start_time, end_time, total_hours, task_id')
          .in('user_id', userIds)
          .gte('start_time', startOfDay)
          .lte('start_time', endOfDay)
          .order('start_time', { ascending: true }),
        supabase
          .from('tasks')
          .select('id, title, assigned_to, status')
          .in('assigned_to', userIds)
          .eq('status', 'in_progress'),
        supabase
          .from('verification_logs')
          .select('id, user_id, task_id, status, triggered_at, distance_from_target')
          .gte('triggered_at', startOfDay)
          .in('status', ['missed', 'failed', 'out_of_range', 'skipped'])
          .order('triggered_at', { ascending: false })
          .limit(50),
      ]);

      const tasksByWorker = new Map<string, { title: string }>();
      (tasksRes.data || []).forEach(t => tasksByWorker.set(t.assigned_to, { title: t.title }));

      const activities: WorkerActivity[] = workersData.map(w => {
        const logs = (logsRes.data || []).filter(l => l.user_id === w.user_id);
        const clockIn = logs[0]?.start_time || null;
        const lastLog = logs[logs.length - 1];
        const allClosed = logs.length > 0 && logs.every(l => l.end_time);
        const clockOut = allClosed ? lastLog?.end_time : null;
        const hours = logs.reduce((s, l) => {
          if (l.total_hours) return s + l.total_hours;
          if (l.start_time && l.end_time) {
            return s + (new Date(l.end_time).getTime() - new Date(l.start_time).getTime()) / 3600000;
          }
          return s;
        }, 0);
        const current = tasksByWorker.get(w.user_id);
        return {
          user_id: w.user_id,
          full_name: w.full_name,
          role: w.role,
          clock_in: clockIn,
          clock_out: clockOut,
          hours_today: hours,
          current_task_title: current?.title || null,
          is_active: !!current || (logs.length > 0 && !allClosed),
        };
      });

      setWorkers(activities);
      setIssues(
        (verifRes.data || []).map(v => ({
          id: v.id,
          user_id: v.user_id,
          worker_name: nameMap.get(v.user_id) || 'Unknown',
          task_id: v.task_id,
          status: v.status,
          triggered_at: v.triggered_at,
          distance_from_target: v.distance_from_target,
        }))
      );
    } catch (e) {
      console.error('Error fetching worker activity:', e);
    } finally {
      setLoading(false);
    }
  };

  if (userRole !== 'admin' && userRole !== 'supervisor') {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Worker activity tracking is only available for supervisors and administrators.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">Loading worker activity...</CardContent>
      </Card>
    );
  }

  const activeWorkers = workers.filter(w => w.is_active);
  const clockedIn = workers.filter(w => w.clock_in && !w.clock_out);
  const clockedOut = workers.filter(w => w.clock_in && w.clock_out);
  const totalHours = workers.reduce((s, w) => s + w.hours_today, 0);

  return (
    <div className="space-y-6">
      {/* Verification alerts at top */}
      {issues.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Location Verification Issues ({issues.length})</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
              {issues.slice(0, 10).map(i => (
                <div key={i.id} className="flex items-center justify-between text-xs bg-background/50 rounded p-2">
                  <div className="flex items-center gap-2">
                    <MapPinOff className="w-3 h-3" />
                    <span className="font-medium">{i.worker_name}</span>
                    <Badge variant="outline" className="text-[10px]">{i.status}</Badge>
                  </div>
                  <span className="text-muted-foreground">
                    {format(new Date(i.triggered_at), 'HH:mm')}
                    {i.distance_from_target != null && ` · ${Math.round(i.distance_from_target)}m off`}
                  </span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="w-7 h-7 text-green-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-600">{activeWorkers.length}</div>
            <div className="text-xs text-muted-foreground">Active Now</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <LogIn className="w-7 h-7 text-blue-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-blue-600">{clockedIn.length}</div>
            <div className="text-xs text-muted-foreground">Clocked In</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <LogOut className="w-7 h-7 text-slate-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-slate-600">{clockedOut.length}</div>
            <div className="text-xs text-muted-foreground">Clocked Out</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-7 h-7 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold text-primary">{totalHours.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Hours Today</div>
          </CardContent>
        </Card>
      </div>

      {/* Workers today */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Workforce Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">No workers found.</div>
          ) : (
            <div className="grid gap-2">
              {workers.map(w => {
                const workerIssues = issues.filter(i => i.user_id === w.user_id);
                return (
                <div
                  key={w.user_id}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                    workerIssues.length > 0 ? 'border-destructive/40 bg-destructive/5' : 'hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">
                        {w.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm truncate">{w.full_name}</h4>
                        {workerIssues.length > 0 && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <MapPinOff className="w-3 h-3" />
                            {workerIssues.length} missed
                          </Badge>
                        )}
                      </div>
                      {w.current_task_title ? (
                        <p className="text-xs text-muted-foreground truncate">
                          On: {w.current_task_title}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground capitalize">
                          {w.role.replace('_', ' ')}
                        </p>
                      )}
                      {workerIssues.length > 0 && (
                        <p className="text-[11px] text-destructive mt-1">
                          Last: {workerIssues[0].status} at {format(new Date(workerIssues[0].triggered_at), 'HH:mm')}
                          {workerIssues[0].distance_from_target != null && ` · ${Math.round(workerIssues[0].distance_from_target)}m off`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] text-muted-foreground">In / Out</div>
                      <div className="text-xs font-mono">
                        {w.clock_in ? format(new Date(w.clock_in), 'HH:mm') : '—'}
                        {' / '}
                        {w.clock_out ? format(new Date(w.clock_out), 'HH:mm') : '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{w.hours_today.toFixed(1)}h</div>
                      <div className="text-[10px] text-muted-foreground">today</div>
                    </div>
                    <Badge variant={w.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {w.is_active ? 'Active' : w.clock_out ? 'Out' : 'Idle'}
                    </Badge>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
