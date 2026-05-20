import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  Clock, 
  Users, 
  Leaf, 
  LogOut, 
  Plus, 
  LayoutDashboard, 
  ClipboardList, 
  CheckSquare, 
  UserPlus, 
  Bell, 
  Sparkles, 
  ListOrdered, 
  RotateCcw, 
  ClipboardCheck, 
  Activity, 
  Menu, 
  User,
  MessageSquare,
  KeyRound,
  FileText,
  BarChart3
} from 'lucide-react';
import { ManageAssignedTasks } from '@/components/tasks/ManageAssignedTasks';
import { TaskAssignment } from '@/components/tasks/TaskAssignment';
import { TaskRequests } from '@/components/tasks/TaskRequests';
import { TaskApproval } from '@/components/tasks/TaskApproval';
import { TaskOverview } from '@/components/tasks/TaskOverview';
import { AIPerformanceDashboard } from '@/components/analytics/AIPerformanceDashboard';
import { AITaskPrioritization } from '@/components/tasks/AITaskPrioritization';
import { WorkerActivityTracker } from '@/components/workers/WorkerActivityTracker';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { TimesheetReports } from '@/components/time/TimesheetReports';
import { PhotoGallery } from '@/components/gallery/PhotoGallery';
import { cn } from '@/lib/utils';
import { UserManagementDashboard } from '@/components/admin/UserManagementDashboard';
import { RedoRequests } from '@/components/tasks/RedoRequests';
import { AdminAnalytics } from '@/components/analytics/AdminAnalytics';
import { UserApproval } from '@/components/admin/UserApproval';
import { CommentsManagement } from '@/components/admin/CommentsManagement';
import { FarmZones } from '@/components/admin/FarmZones';
import { WeeklyTimesheetView } from '@/components/time/WeeklyTimesheetView';
import { Reports } from '@/components/reports/Reports';
import { AuditLogs } from '@/components/admin/AuditLogs';
import { AccessCodeManager } from '@/components/admin/AccessCodeManager';

interface MenuItemCount {
  requests: number;
  approval: number;
  notifications: number;
  redo: number;
}

const menuGroups = [
  {
    title: 'Core Operations',
    items: [
      { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
      { id: 'tasks-overview', label: 'Tasks Board', icon: ClipboardList },
      { id: 'activity', label: 'Worker Activity', icon: Activity },
      { id: 'assign', label: 'Assign Tasks', icon: UserPlus },
      { id: 'manage-tasks', label: 'Manage Tasks', icon: ClipboardCheck },
    ]
  },
  {
    title: 'Reviews & Approvals',
    items: [
      { id: 'user-approvals', label: 'Registration Approvals', icon: Users },
      { id: 'requests', label: 'Task Requests', icon: ClipboardList, countKey: 'requests' as const },
      { id: 'approval', label: 'Task Reviews', icon: CheckSquare, countKey: 'approval' as const },
      { id: 'redo', label: 'Redo Requests', icon: RotateCcw, countKey: 'redo' as const },
    ]
  },
  {
    title: 'Time & Attendance',
    items: [
      { id: 'weekly-timesheet', label: 'Weekly Timesheet', icon: BarChart3 },
      { id: 'timesheet-reports', label: 'Timesheet Reports', icon: CheckCircle },
    ]
  },
  {
    title: 'System Administration',
    items: [
      { id: 'usermanagement', label: 'User Management', icon: Users },
      { id: 'zones', label: 'Farm Zones', icon: Activity },
      { id: 'access-codes', label: 'Access Codes', icon: KeyRound },
      { id: 'audit', label: 'Audit Logs', icon: FileText },
    ]
  },
  {
    title: 'AI & Analytics',
    items: [
      { id: 'ai-analytics', label: 'AI Analytics', icon: Sparkles },
      { id: 'ai-priority', label: 'AI Priority Routing', icon: ListOrdered },
      { id: 'reports', label: 'System Reports', icon: FileText },
    ]
  },
  {
    title: 'Communications',
    items: [
      { id: 'comments', label: 'Comments & Messages', icon: MessageSquare },
      { id: 'notifications', label: 'Notifications', icon: Bell, countKey: 'notifications' as const },
    ]
  }
];

export function SupervisorDashboard() {
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();
  const [activeView, setActiveView] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

    if (!userProfile) return;

    const handler = () => fetchMenuCounts();
    window.addEventListener('notifications-updated', handler);

    const channel = supabase
      .channel(`supervisor-counts-${userProfile.user_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userProfile.user_id}` }, () => fetchMenuCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchMenuCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_requests' }, () => fetchMenuCounts())
      .subscribe();

    return () => {
      window.removeEventListener('notifications-updated', handler);
      supabase.removeChannel(channel);
    };
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
        return <AdminAnalytics />;
      case 'tasks-overview':
        return <TaskOverview userRole="supervisor" />;
      case 'activity':
        return <WorkerActivityTracker userRole="supervisor" />;
      case 'assign':
        return <TaskAssignment />;
      case 'manage-tasks':
        return <ManageAssignedTasks />;
      case 'user-approvals':
        return <UserApproval />;
      case 'requests':
        return <TaskRequests />;
      case 'approval':
        return <TaskApproval />;
      case 'redo':
        return <RedoRequests onRefresh={fetchMenuCounts} />;
      case 'weekly-timesheet':
        return <WeeklyTimesheetView />;
      case 'timesheet-reports':
        return <TimesheetReports />;
      case 'usermanagement':
        return <UserManagementDashboard />;
      case 'zones':
        return <FarmZones />;
      case 'access-codes':
        return <AccessCodeManager />;
      case 'audit':
        return <AuditLogs />;
      case 'ai-analytics':
        return <AIPerformanceDashboard />;
      case 'ai-priority':
        return <AITaskPrioritization />;
      case 'reports':
        return <Reports userRole="supervisor" />;
      case 'comments':
        return <CommentsManagement />;
      case 'notifications':
        return <NotificationCenter />;
      default:
        return <AdminAnalytics />;
    }
  };

  const initials = userProfile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'SP';

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:bg-slate-100/50 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl gradient-green flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-400/15">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-md sm:text-base font-extrabold tracking-tight text-slate-800 leading-tight font-heading">
                Farm<span className="text-primary">Flow</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold hidden sm:block">Supervisor Console</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-100 font-heading">
              {initials}
            </div>
            <div className="text-left leading-tight">
              <p className="text-xs font-bold text-slate-700 font-heading">{userProfile?.full_name}</p>
              <p className="text-[10px] text-slate-400">Supervisor Console</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50 border-emerald-100 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Supervisor
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={async () => {
              await signOut();
              navigate('/auth');
            }}
            className="rounded-xl h-9 text-xs font-semibold border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-[calc(100vh-64px)] relative">
        {/* Sidebar Container */}
        <aside className={cn(
          "w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 absolute md:static z-20 top-0 bottom-0 left-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-full md:w-0 overflow-hidden border-r-0"
        )}>
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
            {menuGroups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const count = item.countKey ? menuCounts[item.countKey] : 0;
                    const active = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-200 active-shrink",
                          active
                            ? "bg-emerald-500/10 text-emerald-400 border-l-3 border-emerald-500 bg-gradient-to-r from-emerald-500/5 to-transparent"
                            : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                        )}
                      >
                        <Icon className={cn("w-4.5 h-4.5 shrink-0", active ? "text-emerald-400" : "text-slate-500")} />
                        <span className="flex-1 text-left font-heading truncate">{item.label}</span>
                        {count > 0 && (
                          <Badge 
                            variant="secondary" 
                            className="ml-auto bg-rose-500 text-white border-0 text-[10px] font-bold min-w-[18px] h-[18px] px-1 justify-center rounded-full shadow-sm animate-pulse"
                          >
                            {count}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 font-sans tracking-wide">
            SYSTEM PORTAL v2.4.0
          </div>
        </aside>

        {/* Backdrop for mobile menu */}
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)} 
            className="fixed inset-0 z-10 bg-slate-900/20 backdrop-blur-xs md:hidden"
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-auto relative">
          <div className="max-w-7xl mx-auto">
            {/* Stats Metrics Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-md rounded-2xl p-0.5 hover-lift transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Allocated Tasks</p>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-0.5 font-heading">Total Assigned</CardTitle>
                  </div>
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Plus className="h-4.5 w-4.5" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-2xl font-extrabold text-slate-800 font-heading">{stats.assignedTasks}</div>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Active allocations in farm fields</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-md rounded-2xl p-0.5 hover-lift transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Work Done</p>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-0.5 font-heading">Completed Tasks</CardTitle>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle className="h-4.5 w-4.5" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-2xl font-extrabold text-emerald-600 font-heading">{stats.completedTasks}</div>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Successfully approved shift items</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-md rounded-2xl p-0.5 hover-lift transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Reviews Pending</p>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-0.5 font-heading">Awaiting Approval</CardTitle>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-2xl font-extrabold text-amber-600 font-heading">{stats.pendingApprovals}</div>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Pending timesheets verification</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-md rounded-2xl p-0.5 hover-lift transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Workforce</p>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-0.5 font-heading">Active Workers</CardTitle>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                    <Users className="h-4.5 w-4.5" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-2xl font-extrabold text-blue-600 font-heading">{stats.activeWorkers}</div>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Registered field operational staff</p>
                </CardContent>
              </Card>
            </div>

            {/* Dynamic Dashboard View */}
            <div className="bg-white/70 backdrop-blur-md border border-slate-100/80 rounded-3xl p-6 shadow-sm min-h-[500px]">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}