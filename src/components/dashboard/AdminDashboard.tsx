import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  CheckCircle, 
  Clock, 
  BarChart3, 
  Leaf, 
  LogOut, 
  LayoutDashboard, 
  Activity, 
  FileText, 
  Bell, 
  Sparkles, 
  ListOrdered,
  Menu
} from 'lucide-react';
import { UserManagementDashboard } from '@/components/admin/UserManagementDashboard';
import { Reports } from '@/components/reports/Reports';
import { AdminAnalytics } from '@/components/analytics/AdminAnalytics';
import { AIPerformanceDashboard } from '@/components/analytics/AIPerformanceDashboard';
import { TaskOverview } from '@/components/tasks/TaskOverview';
import { AITaskPrioritization } from '@/components/tasks/AITaskPrioritization';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ClockInOutView } from '@/components/time/ClockInOutView';
import { WeeklyTimesheetView } from '@/components/time/WeeklyTimesheetView';
import { UserApproval } from '@/components/admin/UserApproval';
import { FarmZones } from '@/components/admin/FarmZones';
import { AuditLogs } from '@/components/admin/AuditLogs';
import { CommentsManagement } from '@/components/admin/CommentsManagement';
import { AccessCodeManager } from '@/components/admin/AccessCodeManager';
import { cn } from '@/lib/utils';

const menuItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'ai-analytics', label: 'AI Analytics', icon: Sparkles },
  { id: 'ai-priority', label: 'AI Priority', icon: ListOrdered },
  { id: 'approvals', label: 'Pending Approvals', icon: Users },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'tasks', label: 'Task Overview', icon: CheckCircle },
  { id: 'comments', label: 'Comments', icon: Bell },
  { id: 'zones', label: 'Farm Zones', icon: Activity },
  { id: 'clockinout', label: 'Clock In/Out', icon: Clock },
  { id: 'timesheet', label: 'Timesheet', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
  { id: 'access-codes', label: 'Access Codes', icon: Activity },
];

export function AdminDashboard() {
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();
  const [activeView, setActiveView] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalHours: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [usersResult, tasksResult, hoursResult] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('time_logs').select('total_hours'),
    ]);

    const totalUsers = usersResult.data?.length || 0;
    const tasks = tasksResult.data || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    const totalHours = hoursResult.data?.reduce((acc, log) => acc + (log.total_hours || 0), 0) || 0;

    setStats({
      totalUsers,
      totalTasks,
      completedTasks,
      pendingTasks,
      totalHours,
    });
  };

  const renderContent = () => {
    switch (activeView) {
      case 'overview':
        return <AdminAnalytics />;
      case 'ai-analytics':
        return <AIPerformanceDashboard />;
      case 'ai-priority':
        return <AITaskPrioritization />;
      case 'approvals':
        return <UserApproval />;
      case 'users':
        return <UserManagementDashboard />;
      case 'tasks':
        return <TaskOverview userRole="admin" />;
      case 'comments':
        return <CommentsManagement />;
      case 'zones':
        return <FarmZones />;
      case 'clockinout':
        return <ClockInOutView />;
      case 'timesheet':
        return <WeeklyTimesheetView />;
      case 'reports':
        return <Reports userRole="admin" />;
      case 'notifications':
        return <NotificationCenter />;
      case 'audit':
        return <AuditLogs />;
      case 'access-codes':
        return <AccessCodeManager />;
      default:
        return <AdminAnalytics />;
    }
  };

  const initials = userProfile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AD';

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
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold hidden sm:block">Administrator Console</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-xs border border-rose-100 font-heading">
              {initials}
            </div>
            <div className="text-left leading-tight">
              <p className="text-xs font-bold text-slate-700 font-heading">{userProfile?.full_name}</p>
              <p className="text-[10px] text-slate-400">Admin Mode</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-rose-50 text-rose-800 hover:bg-rose-50 border-rose-100 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Admin
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
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-200 active-shrink",
                    active
                      ? "bg-emerald-500/10 text-emerald-400 border-l-3 border-emerald-500 bg-gradient-to-r from-emerald-500/5 to-transparent"
                      : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                  )}
                >
                  <Icon className={cn("w-4.5 h-4.5 shrink-0", active ? "text-emerald-400" : "text-slate-500")} />
                  <span className="flex-1 text-left font-heading truncate">{item.label}</span>
                </button>
              );
            })}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
              <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-md rounded-2xl p-0.5 hover-lift transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Accounts</p>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-0.5 font-heading">Total Users</CardTitle>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600">
                    <Users className="h-4.5 w-4.5" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-2xl font-extrabold text-slate-800 font-heading">{stats.totalUsers}</div>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Active account registrations</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-md rounded-2xl p-0.5 hover-lift transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Allocated Tasks</p>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-0.5 font-heading">Total Tasks</CardTitle>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600">
                    <BarChart3 className="h-4.5 w-4.5 animate-pulse" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-2xl font-extrabold text-slate-800 font-heading">{stats.totalTasks}</div>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Cumulative tasks registered</p>
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
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Successfully approved jobs</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-md rounded-2xl p-0.5 hover-lift transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Operations</p>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-0.5 font-heading">Pending Tasks</CardTitle>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-2xl font-extrabold text-amber-600 font-heading">{stats.pendingTasks}</div>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Active pending tasks</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-md rounded-2xl p-0.5 hover-lift transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Shift Work</p>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-0.5 font-heading">Total Hours</CardTitle>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-2xl font-extrabold text-blue-600 font-heading">{stats.totalHours.toFixed(1)}</div>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">Cumulative logged hours</p>
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