import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle, Clock, AlertTriangle, BarChart3, Leaf, LogOut } from 'lucide-react';
import { TaskList } from '@/components/tasks/TaskList';
import { UserManagement } from '@/components/users/UserManagement';
import { TimeTracking } from '@/components/time/TimeTracking';
import { Reports } from '@/components/reports/Reports';

export function AdminDashboard() {
  const { userProfile, signOut } = useAuth();
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

      <div className="p-6">
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

        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="time">Time Tracking</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest garden activities and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">System initialized</span>
                      <span className="text-xs text-muted-foreground">Just now</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>Current system health and performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Database</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Healthy</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Authentication</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <TaskList userRole="admin" />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="time">
            <TimeTracking userRole="admin" />
          </TabsContent>

          <TabsContent value="reports">
            <Reports userRole="admin" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}