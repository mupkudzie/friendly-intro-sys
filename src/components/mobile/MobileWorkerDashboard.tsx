import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobileTaskDetail } from './MobileTaskDetail';
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
  AlertCircle,
  LogOut,
  User,
  MapPin,
  ClipboardList,
  PlayCircle,
  HourglassIcon,
  CheckCheck,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  const [taskTab, setTaskTab] = useState<'pending' | 'review' | 'done'>('pending');

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

  const renderEmptyState = (variant: 'pending' | 'review' | 'done') => {
    const config = {
      pending: {
        icon: <ClipboardList className="h-10 w-10 text-amber-500" />,
        title: 'No active tasks',
        description: 'You have no pending or in-progress tasks right now.',
        action: (
          <Button
            onClick={() => setShowRequestTask(true)}
            variant="outline"
            size="sm"
            className="mt-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Request a Task
          </Button>
        ),
      },
      review: {
        icon: <HourglassIcon className="h-10 w-10 text-purple-500" />,
        title: 'Nothing waiting for approval',
        description: 'Tasks you submit will appear here while supervisors review them.',
        action: null,
      },
      done: {
        icon: <CheckCheck className="h-10 w-10 text-emerald-500" />,
        title: 'No approved tasks yet',
        description: 'Completed and approved tasks will be listed here.',
        action: null,
      },
    }[variant];

    return (
      <Card className="p-8 text-center bg-muted/30 border-dashed">
        <div className="inline-flex items-center justify-center mb-3 rounded-full bg-background p-3 shadow-sm">
          {config.icon}
        </div>
        <h3 className="font-semibold mb-1">{config.title}</h3>
        <p className="text-sm text-muted-foreground">{config.description}</p>
        {config.action}
      </Card>
    );
  };

  return (
    <div className="p-4 space-y-4 pb-20 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold">My Work</h1>
          <p className="text-sm text-muted-foreground">Farm Worker Dashboard</p>
        </div>
        <div className="flex gap-2 items-center">
          <OfflineSyncIndicator />
          <Button onClick={() => setShowRequestTask(true)} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Request</span>
          </Button>
          <Button
            onClick={async () => {
              await signOut();
              navigate('/auth');
            }}
            size="sm"
            variant="outline"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AutoCheckInOut userId={userId} />

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tasks">
            <ClipboardList className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="zones">
            <MapPin className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Zones</span>
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="stats">
            <TrendingUp className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4 mt-4">
          {/* Section selector */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setTaskTab('pending')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl border transition-all',
                taskTab === 'pending'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 shadow-sm'
                  : 'border-border bg-card hover:bg-muted/50'
              )}
            >
              <Clock className={cn('w-5 h-5 mb-1', taskTab === 'pending' ? 'text-amber-600' : 'text-muted-foreground')} />
              <span className="text-2xl font-bold leading-none">{pendingTasks.length}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-center leading-tight">Pending</span>
            </button>
            <button
              onClick={() => setTaskTab('review')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl border transition-all',
                taskTab === 'review'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 shadow-sm'
                  : 'border-border bg-card hover:bg-muted/50'
              )}
            >
              <HourglassIcon className={cn('w-5 h-5 mb-1', taskTab === 'review' ? 'text-purple-600' : 'text-muted-foreground')} />
              <span className="text-2xl font-bold leading-none">{reviewTasks.length}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-center leading-tight">Awaiting Approval</span>
            </button>
            <button
              onClick={() => setTaskTab('done')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl border transition-all',
                taskTab === 'done'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm'
                  : 'border-border bg-card hover:bg-muted/50'
              )}
            >
              <CheckCheck className={cn('w-5 h-5 mb-1', taskTab === 'done' ? 'text-emerald-600' : 'text-muted-foreground')} />
              <span className="text-2xl font-bold leading-none">{doneTasks.length}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-center leading-tight">Finished</span>
            </button>
          </div>

          {/* Section header */}
          <div className="flex items-center justify-between pt-1">
            <h2 className="font-semibold text-lg">
              {taskTab === 'pending' && 'Pending Tasks'}
              {taskTab === 'review' && 'Pending Approval'}
              {taskTab === 'done' && 'Finished & Approved'}
            </h2>
          </div>

          {/* Task list */}
          {taskTab === 'pending' && (
            <div className="space-y-3">
              {pendingTasks.length === 0
                ? renderEmptyState('pending')
                : pendingTasks.map(t => renderTaskCard(t, 'pending'))}
            </div>
          )}
          {taskTab === 'review' && (
            <div className="space-y-3">
              {reviewTasks.length === 0
                ? renderEmptyState('review')
                : reviewTasks.map(t => renderTaskCard(t, 'review'))}
            </div>
          )}
          {taskTab === 'done' && (
            <div className="space-y-3">
              {doneTasks.length === 0
                ? renderEmptyState('done')
                : doneTasks.map(t => renderTaskCard(t, 'done'))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="zones">
          <FarmZonesMap />
        </TabsContent>

        <TabsContent value="profile">
          <WorkerProfile />
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Card className="p-4">
              <div className="flex flex-col items-center text-center">
                <Clock className="h-6 w-6 text-primary mb-2" />
                <p className="text-2xl font-bold">{stats.totalHours.toFixed(1)}</p>
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
        </TabsContent>
      </Tabs>

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
