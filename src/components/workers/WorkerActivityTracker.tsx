import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Activity, 
  Clock, 
  User, 
  AlertTriangle, 
  LogIn, 
  LogOut, 
  MapPin, 
  MapPinOff, 
  Camera, 
  CheckCircle2, 
  Hourglass, 
  RefreshCw, 
  FileImage, 
  Eye, 
  X,
  PlayCircle,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
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

interface PhotoLog {
  id: string;
  user_id: string;
  task_id: string;
  initial_photos: string[];
  final_photos: string[];
  start_time: string;
  end_time: string | null;
  status: string;
  user_name: string;
  task_title: string;
}

interface FeedEvent {
  id: string;
  type: 'clock_in' | 'clock_out' | 'task_start' | 'task_complete' | 'photo_upload' | 'verification_alert' | 'redo_request';
  timestamp: string;
  workerName: string;
  userId: string;
  details: string;
  extraInfo?: string;
  meta?: any;
}

interface WorkerActivityTrackerProps {
  userRole: string;
}

export function WorkerActivityTracker({ userRole }: WorkerActivityTrackerProps) {
  const [workers, setWorkers] = useState<WorkerActivity[]>([]);
  const [issues, setIssues] = useState<VerificationIssue[]>([]);
  const [photoLogs, setPhotoLogs] = useState<PhotoLog[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'supervisor') {
      fetchAll(true);
      const interval = setInterval(() => fetchAll(false), 30000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const fetchAll = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    
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

      const [logsRes, tasksRes, verifRes, activityLogsRes, requestsRes] = await Promise.all([
        supabase
          .from('time_logs')
          .select('id, user_id, start_time, end_time, total_hours, task_id')
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
          .order('triggered_at', { ascending: false }),
        supabase
          .from('activity_logs')
          .select(`
            id, user_id, task_id, initial_photos, final_photos, start_time, end_time, status, created_at,
            profiles!activity_logs_user_id_fkey(full_name),
            tasks!activity_logs_task_id_fkey(title)
          `)
          .gte('created_at', startOfDay)
          .order('created_at', { ascending: false }),
        supabase
          .from('task_requests')
          .select('id, title, requested_by, status, created_at')
          .gte('created_at', startOfDay)
          .order('created_at', { ascending: false })
      ]);

      const tasksByWorker = new Map<string, { title: string }>();
      (tasksRes.data || []).forEach(t => tasksByWorker.set(t.assigned_to, { title: t.title }));

      // 1. Calculate worker activities summary
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

      // 2. Set verification issues
      const verificationIssues: VerificationIssue[] = (verifRes.data || [])
        .filter(v => ['missed', 'failed', 'out_of_range', 'skipped'].includes(v.status))
        .map(v => ({
          id: v.id,
          user_id: v.user_id,
          worker_name: nameMap.get(v.user_id) || 'Unknown',
          task_id: v.task_id,
          status: v.status,
          triggered_at: v.triggered_at,
          distance_from_target: v.distance_from_target,
        }));
      setIssues(verificationIssues);

      // 3. Set photo logs
      const formattedPhotos: PhotoLog[] = (activityLogsRes.data || []).map((log: any) => ({
        id: log.id,
        user_id: log.user_id,
        task_id: log.task_id,
        initial_photos: log.initial_photos || [],
        final_photos: log.final_photos || [],
        start_time: log.start_time || log.created_at,
        end_time: log.end_time,
        status: log.status || 'in_progress',
        user_name: log.profiles?.full_name || 'Unknown User',
        task_title: log.tasks?.title || 'Unknown Task',
      }));
      setPhotoLogs(formattedPhotos.filter(p => p.initial_photos.length > 0 || p.final_photos.length > 0));

      // 4. Construct Chronological activity events feed
      const events: FeedEvent[] = [];

      // Add clock in/outs
      (logsRes.data || []).forEach(log => {
        const workerName = nameMap.get(log.user_id) || 'Unknown Worker';
        events.push({
          id: `in-${log.id}`,
          type: 'clock_in',
          timestamp: log.start_time,
          workerName,
          userId: log.user_id,
          details: 'Clocked in for shift',
        });
        if (log.end_time) {
          events.push({
            id: `out-${log.id}`,
            type: 'clock_out',
            timestamp: log.end_time,
            workerName,
            userId: log.user_id,
            details: 'Clocked out of shift',
            extraInfo: log.total_hours ? `${log.total_hours.toFixed(1)}h total` : undefined,
          });
        }
      });

      // Add task start/completions/photos
      (activityLogsRes.data || []).forEach((log: any) => {
        const workerName = log.profiles?.full_name || 'Unknown Worker';
        const taskTitle = log.tasks?.title || 'Task';
        if (log.start_time) {
          events.push({
            id: `start-${log.id}`,
            type: 'task_start',
            timestamp: log.start_time,
            workerName,
            userId: log.user_id,
            details: `Started task: "${taskTitle}"`,
          });
        }
        if (log.end_time) {
          events.push({
            id: `comp-${log.id}`,
            type: 'task_complete',
            timestamp: log.end_time,
            workerName,
            userId: log.user_id,
            details: `Completed task: "${taskTitle}"`,
          });
        }
        const initial = log.initial_photos || [];
        const final = log.final_photos || [];
        if (initial.length > 0 || final.length > 0) {
          events.push({
            id: `photos-${log.id}`,
            type: 'photo_upload',
            timestamp: log.created_at,
            workerName,
            userId: log.user_id,
            details: `Uploaded ${initial.length + final.length} proof photos for "${taskTitle}"`,
            meta: { initial, final }
          });
        }
      });

      // Add GPS warnings
      (verifRes.data || []).forEach(log => {
        const workerName = nameMap.get(log.user_id) || 'Unknown Worker';
        const isIssue = ['missed', 'failed', 'out_of_range', 'skipped'].includes(log.status);
        if (isIssue) {
          events.push({
            id: `gps-${log.id}`,
            type: 'verification_alert',
            timestamp: log.triggered_at,
            workerName,
            userId: log.user_id,
            details: `GPS verification ${log.status}`,
            extraInfo: log.distance_from_target != null 
              ? `${Math.round(log.distance_from_target)}m distance deviance` 
              : undefined,
          });
        }
      });

      // Add Redo Requests
      (requestsRes.data || []).forEach(req => {
        const workerName = nameMap.get(req.requested_by) || 'Unknown Worker';
        if (req.status === 'redo_pending') {
          events.push({
            id: `redo-${req.id}`,
            type: 'redo_request',
            timestamp: req.created_at,
            workerName,
            userId: req.requested_by,
            details: `Requested permission to redo task: "${req.title}"`,
          });
        }
      });

      // Sort feed chronologically
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setFeedEvents(events);

    } catch (e) {
      console.error('Error fetching activity logs:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getEventIcon = (type: FeedEvent['type']) => {
    switch (type) {
      case 'clock_in':
        return <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm"><LogIn className="w-4 h-4" /></div>;
      case 'clock_out':
        return <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 shadow-sm"><LogOut className="w-4 h-4" /></div>;
      case 'task_start':
        return <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm"><PlayCircle className="w-4 h-4" /></div>;
      case 'task_complete':
        return <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm"><CheckCircle2 className="w-4 h-4" /></div>;
      case 'photo_upload':
        return <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shadow-sm"><Camera className="w-4 h-4" /></div>;
      case 'verification_alert':
        return <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-sm"><AlertTriangle className="w-4 h-4" /></div>;
      case 'redo_request':
        return <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-sm"><Hourglass className="w-4 h-4" /></div>;
    }
  };

  if (userRole !== 'admin' && userRole !== 'supervisor') {
    return (
      <Card className="border-slate-100 shadow-sm rounded-2xl">
        <CardContent className="p-12 text-center text-slate-400">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="font-heading text-sm font-semibold">Access Restrained</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Worker activity logs are restricted to platform administrators and regional supervisors.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase font-heading">Loading Operations Logs...</p>
      </div>
    );
  }

  const activeWorkers = workers.filter(w => w.is_active);
  const clockedIn = workers.filter(w => w.clock_in && !w.clock_out);
  const clockedOut = workers.filter(w => w.clock_in && w.clock_out);
  const totalHours = workers.reduce((s, w) => s + w.hours_today, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner Alerts: verification deviations */}
      {issues.length > 0 && (
        <Card className="border-l-4 border-l-rose-500 border-y border-r border-rose-100 bg-rose-50/20 rounded-2xl overflow-hidden shadow-sm scale-in">
          <CardHeader className="py-3.5 px-4.5 flex flex-row items-center justify-between space-y-0 border-b border-rose-100/50 bg-rose-50/40">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-600 animate-pulse" />
              <div>
                <CardTitle className="text-xs font-bold text-rose-950 font-heading">GPS Anomalies Today ({issues.length})</CardTitle>
                <CardDescription className="text-[10px] text-rose-700/80">Worker location verifications that deviated from target geofences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 space-y-2 max-h-40 overflow-y-auto">
            {issues.slice(0, 10).map(i => (
              <div key={i.id} className="flex items-center justify-between text-[11px] bg-white/70 border border-rose-100/50 rounded-xl p-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <MapPinOff className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-bold text-slate-700">{i.worker_name}</span>
                  <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 border-rose-100 text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded">
                    {i.status}
                  </Badge>
                </div>
                <span className="text-slate-500 font-medium">
                  ⏰ {format(new Date(i.triggered_at), 'HH:mm')}
                  {i.distance_from_target != null && ` · 📍 ${Math.round(i.distance_from_target)}m off-site`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Header Panel with Manual Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/50 backdrop-blur rounded-2xl p-4 border border-slate-100/80 shadow-sm">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 font-heading">Real-Time Operational Activities</h2>
          <p className="text-xs text-slate-500">Live operational events, attendance, and proof reports</p>
        </div>
        <Button 
          onClick={() => fetchAll(true)} 
          variant="outline" 
          className="self-start sm:self-center h-9 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 bg-white"
          disabled={refreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Logs'}
        </Button>
      </div>

      {/* Summary metrics tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/5 to-transparent border-slate-100 rounded-2xl overflow-hidden hover-lift">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Active Now</p>
              <p className="text-2xl font-extrabold text-slate-800 font-heading mt-0.5">{activeWorkers.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center glow-emerald shadow-inner">
              <Activity className="h-5 w-5 text-emerald-600 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500/5 to-transparent border-slate-100 rounded-2xl overflow-hidden hover-lift">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Checked In</p>
              <p className="text-2xl font-extrabold text-slate-800 font-heading mt-0.5">{clockedIn.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center glow-blue shadow-inner">
              <LogIn className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-500/5 to-transparent border-slate-100 rounded-2xl overflow-hidden hover-lift">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Checked Out</p>
              <p className="text-2xl font-extrabold text-slate-800 font-heading mt-0.5">{clockedOut.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shadow-inner">
              <LogOut className="h-5 w-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-500/5 to-transparent border-slate-100 rounded-2xl overflow-hidden hover-lift">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Hours Today</p>
              <p className="text-2xl font-extrabold text-slate-800 font-heading mt-0.5">{totalHours.toFixed(1)}h</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center glow-violet shadow-inner">
              <Clock className="h-5 w-5 text-violet-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabbed Console */}
      <Tabs defaultValue="feed" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-lg mb-4 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="feed" className="rounded-lg text-xs font-semibold py-1.5">Live Feed</TabsTrigger>
          <TabsTrigger value="directory" className="rounded-lg text-xs font-semibold py-1.5">Workforce</TabsTrigger>
          <TabsTrigger value="photos" className="rounded-lg text-xs font-semibold py-1.5">Photo Proofs</TabsTrigger>
          <TabsTrigger value="alerts" className="rounded-lg text-xs font-semibold py-1.5">GPS Alerts</TabsTrigger>
        </TabsList>

        {/* Tab 1: Chronological Activity Timeline */}
        <TabsContent value="feed" className="space-y-4">
          <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white p-5">
            <h3 className="font-bold text-slate-800 text-sm font-heading mb-4.5">Operations Timeline Feed</h3>
            
            {feedEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold">No operational updates logged today</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                {feedEvents.map(event => (
                  <div key={event.id} className="relative flex gap-4 text-xs scale-in">
                    {/* Event icon aligned to vertical timeline bar */}
                    <div className="absolute -left-[27px] mt-0.5 bg-white rounded-full p-0.5">
                      {getEventIcon(event.type)}
                    </div>
                    
                    <div className="flex-1 bg-slate-50/40 border border-slate-100/60 rounded-2xl p-3.5 hover-lift shadow-sm max-w-4xl">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 font-sans text-[12.5px]">
                            {event.workerName} <span className="font-normal text-slate-500">{event.details}</span>
                          </p>
                          {event.extraInfo && (
                            <p className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-100/50 inline-block px-2 py-0.5 rounded-md mt-1">
                              ⚠️ {event.extraInfo}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0 self-start sm:self-center">
                          ⏰ {format(new Date(event.timestamp), 'HH:mm')}
                        </span>
                      </div>

                      {/* Photo Attachments embedded directly inline */}
                      {event.type === 'photo_upload' && event.meta && (
                        <div className="mt-3.5 grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {[...(event.meta.initial || []), ...(event.meta.final || [])].map((imgUrl, i) => (
                            <div 
                              key={i} 
                              onClick={() => setSelectedPhoto(imgUrl)}
                              className="relative aspect-square rounded-xl cursor-pointer overflow-hidden border border-slate-200/80 hover:border-emerald-500 transition-colors bg-slate-100"
                            >
                              <img src={imgUrl} className="w-full h-full object-cover" alt="Verification proof" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Workforce Directory Cards & Shift Progress */}
        <TabsContent value="directory">
          <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white p-5">
            <h3 className="font-bold text-slate-800 text-sm font-heading mb-4">Workforce Status</h3>
            
            {workers.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <User className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold">No operations staff logged today</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {workers.map(w => {
                  const workerIssues = issues.filter(i => i.user_id === w.user_id);
                  const progressVal = Math.min((w.hours_today / 8) * 100, 100);
                  const initials = w.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  
                  return (
                    <Card 
                      key={w.user_id} 
                      className={`border overflow-hidden hover-lift shadow-sm ${
                        workerIssues.length > 0 ? 'border-l-4 border-l-rose-500 border-slate-100 bg-rose-50/5' : 'border-slate-100'
                      }`}
                    >
                      <CardContent className="p-4 space-y-3.5">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-slate-100 shadow-sm">
                              <AvatarFallback className="text-xs font-bold bg-slate-50 text-slate-700 font-heading">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-800 text-sm truncate font-sans">{w.full_name}</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">
                                {w.role.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant={w.is_active ? 'default' : 'secondary'} 
                            className={`text-[9px] font-bold uppercase tracking-wider ${
                              w.is_active 
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                                : w.clock_out 
                                ? 'bg-slate-200 text-slate-600' 
                                : 'bg-amber-100 text-amber-700 border-amber-200'
                            }`}
                          >
                            {w.is_active ? 'Active' : w.clock_out ? 'Off Shift' : 'Idle'}
                          </Badge>
                        </div>

                        {/* Active operation details */}
                        {w.current_task_title ? (
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 shrink-0">Active task:</span>
                            <span className="text-[11px] font-bold text-slate-800 truncate pl-2">{w.current_task_title}</span>
                          </div>
                        ) : (
                          <div className="bg-slate-100/50 rounded-xl p-2.5 text-center text-slate-400 text-[10px] font-medium">
                            No operations currently active
                          </div>
                        )}

                        {/* Location failure alerts */}
                        {workerIssues.length > 0 && (
                          <div className="bg-rose-50 border border-rose-100/50 rounded-xl p-2.5 flex items-center gap-2 text-[10px] text-rose-700">
                            <MapPinOff className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                            <span className="font-medium truncate">
                              GPS failed ({workerIssues[0].status}) at {format(new Date(workerIssues[0].triggered_at), 'HH:mm')}
                            </span>
                          </div>
                        )}

                        {/* Attendance Stats & Shift progress */}
                        <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-slate-400 uppercase tracking-wider">Shift progress</span>
                            <span className="text-slate-700 font-mono">{w.hours_today.toFixed(1)} / 8.0 hrs</span>
                          </div>
                          
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                w.is_active ? 'gradient-green glow-emerald' : 'bg-slate-400'
                              }`} 
                              style={{ width: `${progressVal}%` }} 
                            />
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 font-mono">
                            <span>Clock In: {w.clock_in ? format(new Date(w.clock_in), 'HH:mm') : '—'}</span>
                            <span>Clock Out: {w.clock_out ? format(new Date(w.clock_out), 'HH:mm') : '—'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 3: Photo Proofs Gallery Grid */}
        <TabsContent value="photos">
          <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white p-5">
            <h3 className="font-bold text-slate-800 text-sm font-heading mb-4">Worker Photo Proofs Today</h3>

            {photoLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Camera className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold">No proof photos uploaded today</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {photoLogs.map(log => (
                  <Card key={log.id} className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="p-4.5 bg-slate-50/50 border-b border-slate-100/50 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-[13px] font-extrabold text-slate-800 font-heading">{log.task_title}</CardTitle>
                        <CardDescription className="text-[10px] text-slate-400 font-semibold mt-0.5">Submitted by {log.user_name}</CardDescription>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full">
                        {log.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Before work images */}
                      {log.initial_photos.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                            📸 Initial Setup ({log.initial_photos.length})
                          </h4>
                          <div className="grid grid-cols-4 gap-2">
                            {log.initial_photos.map((photo, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => setSelectedPhoto(photo)}
                                className="relative aspect-square rounded-xl cursor-pointer overflow-hidden border border-slate-200/60 hover:border-emerald-500 transition-colors bg-slate-100"
                              >
                                <img src={photo} className="w-full h-full object-cover" alt="Setup proof" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* After work images */}
                      {log.final_photos.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                            ✅ Final Output ({log.final_photos.length})
                          </h4>
                          <div className="grid grid-cols-4 gap-2">
                            {log.final_photos.map((photo, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => setSelectedPhoto(photo)}
                                className="relative aspect-square rounded-xl cursor-pointer overflow-hidden border border-slate-200/60 hover:border-emerald-500 transition-colors bg-slate-100"
                              >
                                <img src={photo} className="w-full h-full object-cover" alt="Final proof" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 4: Location Failures List */}
        <TabsContent value="alerts">
          <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white p-5">
            <h3 className="font-bold text-slate-800 text-sm font-heading mb-4">Location Failure Detail Reports</h3>

            {issues.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <MapPin className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold">No location failures logged today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map(issue => (
                  <Card key={issue.id} className="border border-rose-100 bg-rose-50/5 hover-lift shadow-sm rounded-2xl overflow-hidden">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center glow-rose border border-rose-100">
                          <MapPinOff className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-sm font-heading">{issue.worker_name}</h4>
                          <p className="text-[11px] text-slate-500">
                            Location verification triggers logged <Badge variant="destructive" className="text-[9px] py-0 px-1 hover:bg-destructive rounded">{issue.status}</Badge>
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-right self-end sm:self-center">
                        <div className="text-left sm:text-right leading-tight">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Distance Deviance</p>
                          <p className="text-xs font-bold text-rose-600 font-mono mt-0.5">
                            {issue.distance_from_target != null ? `${Math.round(issue.distance_from_target)} meters off-site` : 'Deviated location'}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 font-mono">
                          ⏰ {format(new Date(issue.triggered_at), 'HH:mm')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lightbox photo viewer overlay */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-full max-h-full w-screen h-screen p-0 bg-slate-950/95 border-0 rounded-none relative">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 bg-slate-900/60 hover:bg-slate-800/80 rounded-xl text-white hover:text-white"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            {selectedPhoto && (
              <img
                src={selectedPhoto}
                alt="Full resolution proof preview"
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
