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
import { TaskRequests } from '@/components/tasks/TaskRequests';
import { TaskTemplates } from '@/components/tasks/TaskTemplates';
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
      <div className="border-b bg-card shadow-sm">
        <div className="flex h-16 items-center mobile-optimized">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg gradient-green">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">NUST Garden</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Supervisor Dashboard</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <div className="text-xs sm:text-sm text-muted-foreground hidden md:block">
              Welcome, {userProfile?.full_name}
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
              Supervisor
            </Badge>
            <Button variant="outline" size="sm" onClick={signOut} className="h-8 w-8 sm:w-auto sm:h-9">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="mobile-optimized">
        {/* Stats Cards */}
        <div className="mobile-grid mb-6">
          <Card className="mobile-card fade-in hover:shadow-md transition-all duration-200">
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
          <Card className="mobile-card fade-in hover:shadow-md transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.completedTasks}</div>
            </CardContent>
          </Card>
          <Card className="mobile-card fade-in hover:shadow-md transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.pendingApprovals}</div>
            </CardContent>
          </Card>
          <Card className="mobile-card fade-in hover:shadow-md transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
              <div className="p-2 rounded-lg bg-info/10">
                <Users className="h-4 w-4 text-info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{stats.activeWorkers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 lg:grid-cols-7 p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm">Tasks</TabsTrigger>
            <TabsTrigger value="assign" className="text-xs sm:text-sm">Assign</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs sm:text-sm">Templates</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs sm:text-sm">Performance</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs sm:text-sm">Notifications</TabsTrigger>
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

          <TabsContent value="templates">
            <TaskTemplates />
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