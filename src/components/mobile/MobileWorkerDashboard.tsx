import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileTaskDetail } from './MobileTaskDetail';
import { LocationReverification } from './LocationReverification';
import { RequestTask } from '../tasks/RequestTask';
import { WorkerProfile } from './WorkerProfile';
import { FarmZonesMap } from './FarmZonesMap';
import { AutoCheckInOut } from './AutoCheckInOut';
import { OfflineSyncIndicator } from './OfflineSyncIndicator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Clock,
  CheckCircle2,
  TrendingUp,
  Plus,
  LogOut,
  User,
  MapPin,
  ClipboardList,
  PlayCircle,
  HourglassIcon,
  CheckCheck,
  Calendar,
  ChevronRight,
  Home,
  Archive,
  Leaf,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string;
  location?: string;
  location_type?: string;
  due_date?: string;
  estimated_hours?: number;
  status: string;
  priority: string;
  geofence_lat?: number;
  geofence_lon?: number;
  geofence_radius?: number;
  instructions?: string;
  verify_time_1_min?: number | null;
  verify_time_2_min?: number | null;
  verify_time_1_at?: string | null;
  verify_time_2_at?: string | null;
  started_at?: string | null;
}

interface MobileWorkerDashboardProps {
  userId: string;
  userRole: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

type Screen = 'home' | 'tasks' | 'completed' | 'zones' | 'profile';

export function MobileWorkerDashboard({ userId, userRole }: MobileWorkerDashboardProps) {
  const navigate = useNavigate();
  const { signOut, userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    totalHours: 0,
    completedTasks: 0,
    pendingTasks: 0,
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showRequestTask, setShowRequestTask] = useState(false);
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [taskFilter, setTaskFilter] = useState<'pending' | 'review'>('pending');
  const [activeTaskStartTime, setActiveTaskStartTime] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [userId]);

  // Look up the open time_log start_time for any in-progress task so the
  // re-verification scheduler knows when the worker actually clocked in.
  useEffect(() => {
    const activeTask = tasks.find(t => t.status === 'in_progress');
    if (!activeTask) {
      setActiveTaskStartTime(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('time_logs')
        .select('start_time')
        .eq('task_id', activeTask.id)
        .eq('user_id', userId)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveTaskStartTime(data?.start_time ?? null);
    })();
  }, [tasks, userId]);

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

  // Group tasks
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const reviewTasks = tasks.filter(t => t.status === 'pending_approval');
  const doneTasks = tasks.filter(t => t.status === 'approved');

  const renderTaskCard = (task: Task, variant: 'pending' | 'review' | 'done') => {
    const priorityColor = PRIORITY_COLORS[task.priority] || 'bg-slate-400';
    const isInProgress = task.status === 'in_progress';

    let statusBadge: React.ReactNode = null;
    let statusIcon: React.ReactNode = null;
    let accentClasses = '';

    if (variant === 'pending') {
      if (isInProgress) {
        statusBadge = (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
            <PlayCircle className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        );
        statusIcon = <PlayCircle className="w-5 h-5 text-blue-600" />;
        accentClasses = 'border-l-blue-500';
      } else {
        statusBadge = (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            To Do
          </Badge>
        );
        statusIcon = <Clock className="w-5 h-5 text-amber-600" />;
        accentClasses = 'border-l-amber-500';
      }
    } else if (variant === 'review') {
      statusBadge = (
        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200">
          <HourglassIcon className="w-3 h-3 mr-1" />
          Awaiting Approval
        </Badge>
      );
      statusIcon = <HourglassIcon className="w-5 h-5 text-purple-600" />;
      accentClasses = 'border-l-purple-500';
    } else {
      statusBadge = (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
          <CheckCheck className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
      statusIcon = <CheckCheck className="w-5 h-5 text-emerald-600" />;
      accentClasses = 'border-l-emerald-500';
    }

    return (
      <Card
        key={task.id}
        className={cn(
          'p-4 border-l-4 cursor-pointer hover:shadow-lg active:scale-[0.99] transition-all',
          accentClasses
        )}
        onClick={() => setSelectedTask(task)}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">{statusIcon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h3 className="font-semibold text-base leading-tight truncate">{task.title}</h3>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
            </div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {task.description}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              {statusBadge}
              <Badge variant="outline" className="text-xs gap-1">
                <span className={cn('w-2 h-2 rounded-full', priorityColor)} />
                {PRIORITY_LABEL[task.priority] || task.priority}
              </Badge>
              {task.due_date && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(task.due_date), 'MMM d')}
                </span>
              )}
              {task.location && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate max-w-[120px]">
                  <MapPin className="w-3 h-3" />
                  {task.location}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderEmpty = (icon: React.ReactNode, title: string, description: string, action?: React.ReactNode) => (
    <Card className="p-8 text-center bg-muted/30 border-dashed">
      <div className="inline-flex items-center justify-center mb-3 rounded-full bg-background p-3 shadow-sm">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action}
    </Card>
  );

  // ================= Screens =================

  const HomeScreen = () => (
    <div className="space-y-4">
      {/* Greeting */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Welcome back</p>
            <h2 className="text-xl font-bold leading-tight">{userProfile?.full_name || 'Farm Worker'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(), 'EEEE, MMM d')}
            </p>
          </div>
          <div className="rounded-full bg-primary/15 p-3">
            <Leaf className="w-7 h-7 text-primary" />
          </div>
        </div>
      </Card>

      <AutoCheckInOut userId={userId} />

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold leading-none">{stats.totalHours.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Hours</p>
        </Card>
        <Card className="p-3 text-center">
          <PlayCircle className="h-5 w-5 text-blue-600 mx-auto mb-1" />
          <p className="text-lg font-bold leading-none">{pendingTasks.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Active</p>
        </Card>
        <Card className="p-3 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-lg font-bold leading-none">{stats.completedTasks}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Done</p>
        </Card>
      </div>

      {/* Quick actions grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setActiveScreen('tasks'); setTaskFilter('pending'); }}
          className="rounded-2xl border bg-card p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
        >
          <div className="rounded-xl bg-amber-100 w-10 h-10 flex items-center justify-center mb-3">
            <ClipboardList className="w-5 h-5 text-amber-700" />
          </div>
          <p className="font-semibold">My Tasks</p>
          <p className="text-xs text-muted-foreground">{pendingTasks.length} active · {reviewTasks.length} in review</p>
        </button>
        <button
          onClick={() => setActiveScreen('completed')}
          className="rounded-2xl border bg-card p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
        >
          <div className="rounded-xl bg-emerald-100 w-10 h-10 flex items-center justify-center mb-3">
            <Archive className="w-5 h-5 text-emerald-700" />
          </div>
          <p className="font-semibold">Completed</p>
          <p className="text-xs text-muted-foreground">{doneTasks.length} approved tasks</p>
        </button>
        <button
          onClick={() => setActiveScreen('zones')}
          className="rounded-2xl border bg-card p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
        >
          <div className="rounded-xl bg-blue-100 w-10 h-10 flex items-center justify-center mb-3">
            <MapPin className="w-5 h-5 text-blue-700" />
          </div>
          <p className="font-semibold">Farm Zones</p>
          <p className="text-xs text-muted-foreground">View work areas</p>
        </button>
        <button
          onClick={() => setShowRequestTask(true)}
          className="rounded-2xl border bg-card p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
        >
          <div className="rounded-xl bg-primary/15 w-10 h-10 flex items-center justify-center mb-3">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <p className="font-semibold">Request Task</p>
          <p className="text-xs text-muted-foreground">Ask supervisor</p>
        </button>
      </div>

      {/* Up next preview */}
      {pendingTasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Up next</h3>
            <button
              onClick={() => { setActiveScreen('tasks'); setTaskFilter('pending'); }}
              className="text-xs text-primary font-medium"
            >
              See all
            </button>
          </div>
          {pendingTasks.slice(0, 2).map(t => renderTaskCard(t, 'pending'))}
        </div>
      )}
    </div>
  );

  const TasksScreen = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">My Tasks</h2>
        <p className="text-sm text-muted-foreground">Active and awaiting approval</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setTaskFilter('pending')}
          className={cn(
            'flex items-center justify-between p-3 rounded-xl border transition-all',
            taskFilter === 'pending'
              ? 'border-amber-500 bg-amber-50 shadow-sm'
              : 'border-border bg-card'
          )}
        >
          <div className="flex items-center gap-2">
            <Clock className={cn('w-4 h-4', taskFilter === 'pending' ? 'text-amber-600' : 'text-muted-foreground')} />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <Badge variant="secondary">{pendingTasks.length}</Badge>
        </button>
        <button
          onClick={() => setTaskFilter('review')}
          className={cn(
            'flex items-center justify-between p-3 rounded-xl border transition-all',
            taskFilter === 'review'
              ? 'border-purple-500 bg-purple-50 shadow-sm'
              : 'border-border bg-card'
          )}
        >
          <div className="flex items-center gap-2">
            <HourglassIcon className={cn('w-4 h-4', taskFilter === 'review' ? 'text-purple-600' : 'text-muted-foreground')} />
            <span className="text-sm font-medium">In Review</span>
          </div>
          <Badge variant="secondary">{reviewTasks.length}</Badge>
        </button>
      </div>

      {taskFilter === 'pending' && (
        <div className="space-y-3">
          {pendingTasks.length === 0
            ? renderEmpty(
                <ClipboardList className="h-10 w-10 text-amber-500" />,
                'No active tasks',
                'You have no pending or in-progress tasks right now.',
                <Button onClick={() => setShowRequestTask(true)} variant="outline" size="sm" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Request a Task
                </Button>
              )
            : pendingTasks.map(t => renderTaskCard(t, 'pending'))}
        </div>
      )}
      {taskFilter === 'review' && (
        <div className="space-y-3">
          {reviewTasks.length === 0
            ? renderEmpty(
                <HourglassIcon className="h-10 w-10 text-purple-500" />,
                'Nothing waiting for approval',
                'Tasks you submit will appear here while supervisors review them.'
              )
            : reviewTasks.map(t => renderTaskCard(t, 'review'))}
        </div>
      )}
    </div>
  );

  const CompletedScreen = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Completed</h2>
        <p className="text-sm text-muted-foreground">Approved &amp; finished tasks</p>
      </div>
      <Card className="p-4 bg-emerald-50 border-emerald-200">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-100 p-2.5">
            <CheckCheck className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-800 leading-none">{doneTasks.length}</p>
            <p className="text-xs text-emerald-700 mt-1">Tasks approved by supervisor</p>
          </div>
        </div>
      </Card>
      <div className="space-y-3">
        {doneTasks.length === 0
          ? renderEmpty(
              <CheckCheck className="h-10 w-10 text-emerald-500" />,
              'No approved tasks yet',
              'Completed and approved tasks will be listed here.'
            )
          : doneTasks.map(t => renderTaskCard(t, 'done'))}
      </div>
    </div>
  );

  // ================= Bottom nav =================

  const BottomNav = () => {
    const navItems: { id: Screen; label: string; icon: React.ElementType; badge?: number }[] = [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'tasks', label: 'Tasks', icon: ClipboardList, badge: pendingTasks.length + reviewTasks.length },
      { id: 'completed', label: 'Done', icon: Archive, badge: doneTasks.length },
      { id: 'zones', label: 'Zones', icon: MapPin },
      { id: 'profile', label: 'Profile', icon: User },
    ];

    return (
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors relative',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="relative">
                  <Icon className={cn('w-5 h-5', active && 'scale-110')} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={cn('text-[10px]', active && 'font-semibold')}>{item.label}</span>
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    );
  };

  // ================= Layout =================

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      {/* Top app bar */}
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/15 p-1.5">
              <Leaf className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">FarmFlow</span>
          </div>
          <div className="flex items-center gap-1">
            <OfflineSyncIndicator />
            <Button
              onClick={async () => {
                await signOut();
                navigate('/auth');
              }}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {activeScreen === 'home' && <HomeScreen />}
        {activeScreen === 'tasks' && <TasksScreen />}
        {activeScreen === 'completed' && <CompletedScreen />}
        {activeScreen === 'zones' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Farm Zones</h2>
              <p className="text-sm text-muted-foreground">Work areas and locations</p>
            </div>
            <FarmZonesMap />
          </div>
        )}
        {activeScreen === 'profile' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Profile</h2>
              <p className="text-sm text-muted-foreground">Your details and stats</p>
            </div>
            <WorkerProfile />
          </div>
        )}
      </main>

      <BottomNav />

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

      {/* Global location re-verification: fires on any screen while a task is in progress */}
      {(() => {
        const activeTask = tasks.find(t => t.status === 'in_progress');
        if (!activeTask) return null;
        return (
          <div className="fixed bottom-20 left-0 right-0 z-40 px-4 pointer-events-none">
            <div className="pointer-events-auto max-w-md mx-auto">
              <LocationReverification
                taskId={activeTask.id}
                taskLocation={{
                  latitude: activeTask.geofence_lat || 0,
                  longitude: activeTask.geofence_lon || 0,
                  radius: activeTask.geofence_radius || 100,
                }}
                isTaskActive={true}
                locationTypeIsFarm={activeTask.location_type !== 'current_location'}
                taskStartTime={activeTask.started_at ?? null}
                verifyTime1Min={activeTask.verify_time_1_min ?? null}
                verifyTime2Min={activeTask.verify_time_2_min ?? null}
                verifyTime1At={activeTask.verify_time_1_at ?? null}
                verifyTime2At={activeTask.verify_time_2_at ?? null}
              />
            </div>
          </div>
        );
      })()}

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
