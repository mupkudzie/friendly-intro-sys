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
  Sparkles,
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
  urgent: 'bg-rose-500 shadow-rose-500/20',
  high: 'bg-orange-500 shadow-orange-500/20',
  medium: 'bg-amber-500 shadow-amber-500/20',
  low: 'bg-emerald-500 shadow-emerald-500/20',
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

type Screen = 'home' | 'tasks' | 'completed' | 'profile';

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

  useEffect(() => {
    const handler = () => setActiveScreen('home');
    window.addEventListener('goto-home', handler);
    return () => window.removeEventListener('goto-home', handler);
  }, []);

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
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping mr-1.5" />
            In Progress
          </Badge>
        );
        statusIcon = <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center glow-blue"><PlayCircle className="w-5 h-5" /></div>;
        accentClasses = 'border-l-blue-500';
      } else {
        statusBadge = (
          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            To Do
          </Badge>
        );
        statusIcon = <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Clock className="w-5 h-5" /></div>;
        accentClasses = 'border-l-amber-500';
      }
    } else if (variant === 'review') {
      statusBadge = (
        <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200">
          <HourglassIcon className="w-3 h-3 mr-1" />
          Awaiting Approval
        </Badge>
      );
      statusIcon = <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><HourglassIcon className="w-5 h-5" /></div>;
      accentClasses = 'border-l-purple-500';
    } else {
      statusBadge = (
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200">
          <CheckCheck className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
      statusIcon = <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center glow-emerald"><CheckCheck className="w-5 h-5" /></div>;
      accentClasses = 'border-l-emerald-500';
    }

    return (
      <Card
        key={task.id}
        className={cn(
          'p-4 border-l-4 hover-lift active-shrink cursor-pointer shadow-sm relative overflow-hidden bg-white/70 backdrop-blur-md rounded-2xl border-y border-r border-slate-100/80 mb-3',
          accentClasses
        )}
        onClick={() => setSelectedTask(task)}
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0">{statusIcon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-bold text-slate-800 leading-tight truncate font-heading text-[15px]">{task.title}</h3>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            </div>
            <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              {statusBadge}
              <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5 rounded-lg border-slate-200 text-slate-600">
                <span className={cn('w-1.5 h-1.5 rounded-full shadow-sm', priorityColor)} />
                {PRIORITY_LABEL[task.priority] || task.priority}
              </Badge>
              {task.due_date && (
                <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(task.due_date), 'MMM d')}
                </span>
              )}
              {task.location && (
                <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5 truncate max-w-[120px]">
                  <MapPin className="w-2.5 h-2.5" />
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
    <Card className="p-8 text-center bg-slate-100/40 backdrop-blur border-slate-200/50 border-dashed rounded-2xl">
      <div className="inline-flex items-center justify-center mb-4.5 rounded-2xl bg-white p-3.5 shadow-md shadow-slate-100/50">
        {icon}
      </div>
      <h3 className="font-bold text-slate-800 mb-1 font-heading text-base">{title}</h3>
      <p className="text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">{description}</p>
      {action}
    </Card>
  );

  // ================= Screens =================

  const HomeScreen = () => {
    const initials = userProfile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'FW';
    return (
      <div className="space-y-5 fade-in">
        {/* Greeting Banner */}
        <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white border-0 shadow-lg relative overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-6 translate-x-6 blur-[30px]" />
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Welcome back</p>
              <h2 className="text-xl font-bold leading-tight font-heading">{userProfile?.full_name || 'Farm Worker'}</h2>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-400 mt-1">
                <Sparkles className="w-3 h-3 animate-spin text-emerald-400" />
                Active Shift
              </div>
            </div>
            <div className="w-12 h-12 rounded-full gradient-green border border-white/20 flex items-center justify-center font-bold text-white shadow-inner font-heading text-sm">
              {initials}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-sans">
            <span>📅 {format(new Date(), 'EEEE, MMM d')}</span>
            <span>📍 Zone: Central Fields</span>
          </div>
        </Card>

        <AutoCheckInOut userId={userId} />

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3.5 text-center bg-white/70 backdrop-blur-md border-slate-100 rounded-2xl shadow-sm hover-lift cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2"><Clock className="h-4.5 w-4.5 text-emerald-600" /></div>
            <p className="text-lg font-extrabold leading-none text-slate-800 font-heading">{stats.totalHours.toFixed(1)}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mt-1.5">Hours</p>
          </Card>
          <Card className="p-3.5 text-center bg-white/70 backdrop-blur-md border-slate-100 rounded-2xl shadow-sm hover-lift cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2"><PlayCircle className="h-4.5 w-4.5 text-blue-600 animate-pulse" /></div>
            <p className="text-lg font-extrabold leading-none text-slate-800 font-heading">{pendingTasks.length}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mt-1.5">Active</p>
          </Card>
          <Card className="p-3.5 text-center bg-white/70 backdrop-blur-md border-slate-100 rounded-2xl shadow-sm hover-lift cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-2"><HourglassIcon className="h-4.5 w-4.5 text-purple-600" /></div>
            <p className="text-lg font-extrabold leading-none text-slate-800 font-heading">{reviewTasks.length}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mt-1.5">In Review</p>
          </Card>
        </div>

        {/* Quick actions grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setActiveScreen('tasks'); setTaskFilter('pending'); }}
            className="rounded-3xl border border-slate-100 bg-white/80 backdrop-blur p-4.5 text-left hover-lift active-shrink shadow-sm hover:shadow-md transition-all"
          >
            <div className="rounded-2xl bg-amber-50 w-11 h-11 flex items-center justify-center mb-3">
              <ClipboardList className="w-5.5 h-5.5 text-amber-600" />
            </div>
            <p className="font-bold text-slate-800 text-sm font-heading">My Tasks</p>
            <p className="text-[10px] text-slate-400 mt-1">{pendingTasks.length} pending · {reviewTasks.length} in review</p>
          </button>
          <button
            onClick={() => setActiveScreen('completed')}
            className="rounded-3xl border border-slate-100 bg-white/80 backdrop-blur p-4.5 text-left hover-lift active-shrink shadow-sm hover:shadow-md transition-all"
          >
            <div className="rounded-2xl bg-emerald-50 w-11 h-11 flex items-center justify-center mb-3">
              <Archive className="w-5.5 h-5.5 text-emerald-600" />
            </div>
            <p className="font-bold text-slate-800 text-sm font-heading">Completed</p>
            <p className="text-[10px] text-slate-400 mt-1">{doneTasks.length} approved</p>
          </button>
          <button
            onClick={() => setShowRequestTask(true)}
            className="rounded-3xl border border-slate-100 bg-white/80 backdrop-blur p-4.5 text-left hover-lift active-shrink shadow-sm hover:shadow-md transition-all col-span-2"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 w-11 h-11 flex items-center justify-center shrink-0">
                <Plus className="w-5.5 h-5.5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm font-heading">Request Custom Task</p>
                <p className="text-[10px] text-slate-400">Request assignments from your supervisor</p>
              </div>
            </div>
          </button>
        </div>

        {/* Up next preview */}
        {pendingTasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-slate-800 text-sm font-heading">Next Assignments</h3>
              <button
                onClick={() => { setActiveScreen('tasks'); setTaskFilter('pending'); }}
                className="text-xs text-primary font-bold hover:underline"
              >
                See all
              </button>
            </div>
            {pendingTasks.slice(0, 2).map(t => renderTaskCard(t, 'pending'))}
          </div>
        )}
      </div>
    );
  };

  const TasksScreen = () => (
    <div className="space-y-4 fade-in">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800 font-heading">My Operations</h2>
        <p className="text-xs text-slate-500">Track and report active farm operations</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-1 bg-slate-100 rounded-xl">
        <button
          onClick={() => setTaskFilter('pending')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
            taskFilter === 'pending'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Pending</span>
          <Badge className="ml-1 bg-slate-200 text-slate-800 border-0 h-4 px-1.5 text-[9px] hover:bg-slate-200">{pendingTasks.length}</Badge>
        </button>
        <button
          onClick={() => setTaskFilter('review')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
            taskFilter === 'review'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <HourglassIcon className="w-4 h-4 text-purple-600" />
          <span>In Review</span>
          <Badge className="ml-1 bg-slate-200 text-slate-800 border-0 h-4 px-1.5 text-[9px] hover:bg-slate-200">{reviewTasks.length}</Badge>
        </button>
      </div>

      {taskFilter === 'pending' && (
        <div className="space-y-1">
          {pendingTasks.length === 0
            ? renderEmpty(
                <ClipboardList className="h-10 w-10 text-amber-500" />,
                'All caught up!',
                'No pending tasks. Need something to do?',
                <Button onClick={() => setShowRequestTask(true)} variant="outline" size="sm" className="mt-4 rounded-xl font-semibold border-slate-200 text-slate-700 bg-white">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Request a Task
                </Button>
              )
            : pendingTasks.map(t => renderTaskCard(t, 'pending'))}
        </div>
      )}
      {taskFilter === 'review' && (
        <div className="space-y-1">
          {reviewTasks.length === 0
            ? renderEmpty(
                <HourglassIcon className="h-10 w-10 text-purple-500" />,
                'No tasks in review',
                'Your submitted reports will display here during validation.'
              )
            : reviewTasks.map(t => renderTaskCard(t, 'review'))}
        </div>
      )}
    </div>
  );

  const CompletedScreen = () => (
    <div className="space-y-4 fade-in">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800 font-heading">Approved Tasks</h2>
        <p className="text-xs text-slate-500">History of your completed operations</p>
      </div>
      <Card className="p-4 bg-emerald-50/50 border-emerald-100 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-100 w-11 h-11 flex items-center justify-center">
            <CheckCheck className="h-5.5 w-5.5 text-emerald-700" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-emerald-950 leading-none font-heading">{doneTasks.length}</p>
            <p className="text-[10px] text-emerald-700 font-semibold mt-1">Total approved farm tasks</p>
          </div>
        </div>
      </Card>
      <div className="space-y-1">
        {doneTasks.length === 0
          ? renderEmpty(
              <CheckCheck className="h-10 w-10 text-emerald-500" />,
              'No approved tasks yet',
              'Once supervisors approve your completed reports, they will log here.'
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
      { id: 'profile', label: 'Profile', icon: User },
    ];

    return (
      <nav className="fixed bottom-4 left-4 right-4 z-30 rounded-2xl glass-card border border-white/50 shadow-lg px-2 py-1 max-w-md mx-auto">
        <div className="grid grid-cols-4 w-full">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-all relative active-shrink',
                  active ? 'text-primary' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                <div className="relative">
                  <Icon className={cn('w-5 h-5 transition-transform duration-200', active && 'scale-110')} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={cn('text-[9px] font-medium tracking-tight mt-0.5', active && 'font-bold')}>{item.label}</span>
                {active && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-1 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  };

  // ================= Layout =================

  return (
    <div className="min-h-screen bg-slate-50/50 pb-28">
      {/* Top app bar */}
      <header className="sticky top-0 z-20 glass-navbar shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-15">
          <div className="flex items-center gap-2">
            <div className="rounded-xl gradient-green p-1.5 shadow-md shadow-emerald-500/10">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-800 font-heading">FarmFlow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <OfflineSyncIndicator />
            <Button
              onClick={async () => {
                await signOut();
                navigate('/auth');
              }}
              size="icon"
              variant="ghost"
              className="h-8.5 w-8.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            >
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {activeScreen === 'home' && <HomeScreen />}
        {activeScreen === 'tasks' && <TasksScreen />}
        {activeScreen === 'completed' && <CompletedScreen />}
        {activeScreen === 'profile' && (
          <div className="space-y-4 fade-in">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 font-heading">My Profile</h2>
              <p className="text-xs text-slate-500">Manage account information and active settings</p>
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
          <div className="fixed bottom-24 left-0 right-0 z-40 px-4 pointer-events-none">
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
                taskStartTime={activeTaskStartTime}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-0 bg-white shadow-2xl p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold text-slate-900 font-heading">Request Farm Task</DialogTitle>
          </DialogHeader>
          <RequestTask />
        </DialogContent>
      </Dialog>
    </div>
  );
}
