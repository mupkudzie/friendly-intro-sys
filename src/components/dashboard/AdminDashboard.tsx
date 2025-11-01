import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle, Clock, BarChart3, Leaf, LogOut, LayoutDashboard, Activity, FileText, Bell, Images } from 'lucide-react';
import { UserManagement } from '@/components/users/UserManagement';
import { Reports } from '@/components/reports/Reports';
import { AdminAnalytics } from '@/components/analytics/AdminAnalytics';
import { TaskOverview } from '@/components/tasks/TaskOverview';
import { WorkerActivityTracker } from '@/components/workers/WorkerActivityTracker';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ClockInOutView } from '@/components/time/ClockInOutView';
import { WeeklyTimesheetView } from '@/components/time/WeeklyTimesheetView';
import { PhotoGallery } from '@/components/gallery/PhotoGallery';
import { UserApproval } from '@/components/admin/UserApproval';
import { FarmZones } from '@/components/admin/FarmZones';
import { AuditLogs } from '@/components/admin/AuditLogs';
import { cn } from '@/lib/utils';

const menuItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'approvals', label: 'Pending Approvals', icon: Users },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'tasks', label: 'Task Overview', icon: CheckCircle },
  { id: 'zones', label: 'Farm Zones', icon: Activity },
  { id: 'photos', label: 'Photo Gallery', icon: Images },
  { id: 'clockinout', label: 'Clock In/Out', icon: Clock },
  { id: 'timesheet', label: 'Timesheet', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
];

export function AdminDashboard() {
  const { userProfile, signOut } = useAuth();
  const [activeView, setActiveView] = useState('overview');
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
      case 'approvals':
        return <UserApproval />;
      case 'users':
        return <UserManagement />;
      case 'tasks':
        return <TaskOverview userRole="admin" />;
      case 'zones':
        return <FarmZones />;
      case 'photos':
        return <PhotoGallery />;
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
      default:
        return <AdminAnalytics />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-green-600" />
            <h1 className="text-xl font-semibold">NUST Garden - Admin Dashboard</h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Welcome, {userProfile?.full_name}
            </div>
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              Administrator
            </Badge>
            <Button variant="outline" size="sm" onClick={signOut}>
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
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTasks}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.pendingTasks}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                <Clock className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.totalHours.toFixed(1)}</div>
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