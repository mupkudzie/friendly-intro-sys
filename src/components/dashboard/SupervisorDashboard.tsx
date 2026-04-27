import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Users, Leaf, LogOut, Plus, LayoutDashboard, ClipboardList, CheckSquare, UserPlus, FileText, TrendingUp, Activity, Bell, Images, Sparkles, ListOrdered, RotateCcw } from 'lucide-react';
import { TaskAssignment } from '@/components/tasks/TaskAssignment';
import { TaskRequests } from '@/components/tasks/TaskRequests';
import { TaskApproval } from '@/components/tasks/TaskApproval';
import { TaskTemplates } from '@/components/tasks/TaskTemplates';
import { PerformanceEvaluation } from '@/components/performance/PerformanceEvaluation';
import { TaskOverview } from '@/components/tasks/TaskOverview';
import { AIPerformanceDashboard } from '@/components/analytics/AIPerformanceDashboard';
import { AITaskPrioritization } from '@/components/tasks/AITaskPrioritization';
import { WorkerActivityTracker } from '@/components/workers/WorkerActivityTracker';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ClockInOutView } from '@/components/time/ClockInOutView';
import { TimesheetReports } from '@/components/time/TimesheetReports';
import { PhotoGallery } from '@/components/gallery/PhotoGallery';
import { cn } from '@/lib/utils';
import { UserManagementDashboard } from '@/components/admin/UserManagementDashboard';
import { RedoRequests } from '@/components/tasks/RedoRequests';

interface MenuItemCount {
  requests: number;
  approval: number;
  notifications: number;
  redo: number;
}

const menuItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'ai-analytics', label: 'AI Analytics', icon: Sparkles },
  { id: 'ai-priority', label: 'AI Priority', icon: ListOrdered },
  { id: 'requests', label: 'Requests', icon: ClipboardList, countKey: 'requests' as const },
  { id: 'approval', label: 'Review', icon: CheckSquare, countKey: 'approval' as const },
  { id: 'redo', label: 'Redo Requests', icon: RotateCcw, countKey: 'redo' as const },
  { id: 'assign', label: 'Assign', icon: UserPlus },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'clockinout', label: 'Clock In/Out', icon: Clock },
  { id: 'timesheet', label: 'Timesheet', icon: CheckCircle },
  { id: 'notifications', label: 'Notifications', icon: Bell, countKey: 'notifications' as const },
  { id: 'usermanagement', label: 'User Management', icon: Users },
];

export function SupervisorDashboard() {
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();
  const [activeView, setActiveView] = useState('overview');
  const [stats, setStats] = useState({
    assignedTasks: 0,
    completedTasks: 0,
    pendingApprovals: 0,
    activeWorkers: 0,
  });
  const [menuCounts, setMenuCounts] = useState<MenuItemCount>({
    requests: 0,
    approval: 0,
    notifications: 0,
    redo: 0,
  });

  useEffect(() => {
    fetchStats();
    fetchMenuCounts();
  }, [userProfile]);

  const fetchMenuCounts = async () => {
    if (!userProfile) return;

    const [requestsResult, approvalResult, notificationsResult, redoResult] = await Promise.all([
      supabase.from('task_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('tasks').select('id', { count: 'exact' }).eq('status', 'pending_approval'),
      supabase.from('notifications').select('id', { count: 'exact' }).eq('recipient_id', userProfile.user_id).eq('read', false),
      supabase.from('task_requests').select('id', { count: 'exact' }).eq('status', 'redo_pending'),
    ]);

    setMenuCounts({
      requests: requestsResult.count || 0,
      approval: approvalResult.count || 0,
      notifications: notificationsResult.count || 0,
      redo: redoResult.count || 0,
    });
  };

  const fetchStats = async () => {
    if (!userProfile) return;

    const [tasksResult, approvalsResult, workersResult] = await Promise.all([
      supabase.from('tasks').select('*').eq('assigned_by', userProfile.user_id),
      supabase.from('task_reports').select('*').is('approved_by', null),
      supabase.from('profiles').select('*').in('role', ['student', 'garden_worker']).eq('is_deleted', false),
    ]);

    const tasks = tasksResult.data || [];
    const assignedTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
    const pendingApprovals = approvalsResult.data?.length || 0;
    const activeWorkers = workersResult.data?.length || 0;

    setStats({
      assignedTasks,
      completedTasks,
      pendingApprovals,
      activeWorkers,
    });
  };

  const renderContent = () => {
    switch (activeView) {
      case 'overview':
        return <TaskOverview userRole="supervisor" />;
      case 'ai-analytics':
        return <AIPerformanceDashboard />;
      case 'ai-priority':
        return <AITaskPrioritization />;
      case 'requests':
        return <TaskRequests />;
      case 'approval':
        return <TaskApproval />;
      case 'redo':
        return <RedoRequests onRefresh={fetchMenuCounts} />;
      case 'assign':
        return <TaskAssignment />;
      case 'performance':
        return <PerformanceEvaluation userRole="supervisor" />;
      case 'activity':
        return <WorkerActivityTracker userRole="supervisor" />;
      case 'photos':
        return <PhotoGallery />;
      case 'clockinout':
        return <ClockInOutView />;
      case 'timesheet':
        return <TimesheetReports />;
      case 'notifications':
        return <NotificationCenter />;
      case 'usermanagement':
        return <UserManagementDashboard />;
      default:
        return <TaskOverview userRole="supervisor" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-sm">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg gradient-green">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">FarmFlow</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Supervisor Dashboard</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm text-muted-foreground hidden md:block">
              Welcome, {userProfile?.full_name}
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
              Supervisor
            </Badge>
            <Button variant="outline" size="sm" onClick={async () => {
              await signOut();
              navigate('/auth');
            }}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card">
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const count = item.countKey ? menuCounts[item.countKey] : 0;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    activeView === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {count > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="ml-auto bg-destructive text-destructive-foreground text-xs min-w-[20px] justify-center"
                    >
                      {count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card className="fade-in hover:shadow-md transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assigned Tasks</CardTitle>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Plus className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.assignedTasks}</div>
              </CardContent>
            </Card>
            <Card className="fade-in hover:shadow-md transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
              </CardContent>
            </Card>
            <Card className="fade-in hover:shadow-md transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                <div className="p-2 rounded-lg bg-orange-100">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.pendingApprovals}</div>
              </CardContent>
            </Card>
            <Card className="fade-in hover:shadow-md transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.activeWorkers}</div>
              </CardContent>
            </Card>
          </div>

          {/* Dynamic Content */}
          {renderContent()}
        </main>
      </div>
    </div>
  );
}