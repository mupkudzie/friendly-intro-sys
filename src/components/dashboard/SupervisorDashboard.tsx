import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Users, Leaf, LogOut, Plus } from 'lucide-react';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskAssignment } from '@/components/tasks/TaskAssignment';
import { TimeTracking } from '@/components/time/TimeTracking';
import { TaskRequests } from '@/components/tasks/TaskRequests';
import { PerformanceEvaluation } from '@/components/performance/PerformanceEvaluation';
import { TaskOverview } from '@/components/tasks/TaskOverview';
import { WorkerActivityTracker } from '@/components/workers/WorkerActivityTracker';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export function SupervisorDashboard() {
  const { userProfile, signOut } = useAuth();
  const [stats, setStats] = useState({
    assignedTasks: 0,
    completedTasks: 0,
    pendingApprovals: 0,
    activeWorkers: 0,
  });

  useEffect(() => {
    fetchStats();
  }, [userProfile]);

  const fetchStats = async () => {
    if (!userProfile) return;

    const [tasksResult, approvalsResult, workersResult] = await Promise.all([
      supabase.from('tasks').select('*').eq('assigned_by', userProfile.user_id),
      supabase.from('task_reports').select('*').is('approved_by', null),
      supabase.from('profiles').select('*').in('role', ['student', 'garden_worker']),
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-green-600" />
            <h1 className="text-xl font-semibold">NUST Garden - Supervisor Dashboard</h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Welcome, {userProfile?.full_name}
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Supervisor
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Tasks</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.assignedTasks}</div>
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
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingApprovals}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.activeWorkers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="assign">Assign</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <TaskOverview userRole="supervisor" />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskList userRole="supervisor" />
          </TabsContent>

          <TabsContent value="assign">
            <TaskAssignment />
          </TabsContent>

          <TabsContent value="performance">
            <PerformanceEvaluation userRole="supervisor" />
          </TabsContent>

          <TabsContent value="activity">
            <WorkerActivityTracker userRole="supervisor" />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationCenter />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}