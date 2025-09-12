import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Play, Leaf, LogOut, FileText } from 'lucide-react';
import { TaskList } from '@/components/tasks/TaskList';
import { TimeLogger } from '@/components/time/TimeLogger';
import { ReportSubmission } from '@/components/reports/ReportSubmission';
import { RequestTask } from '@/components/tasks/RequestTask';

export function WorkerDashboard() {
  const { userProfile, signOut } = useAuth();
  const [stats, setStats] = useState({
    myTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    totalHours: 0,
  });

  useEffect(() => {
    fetchStats();
  }, [userProfile]);

  const fetchStats = async () => {
    if (!userProfile) return;

    const [tasksResult, hoursResult] = await Promise.all([
      supabase.from('tasks').select('*').eq('assigned_to', userProfile.user_id),
      supabase.from('time_logs').select('total_hours').eq('user_id', userProfile.user_id),
    ]);

    const tasks = tasksResult.data || [];
    const myTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const totalHours = hoursResult.data?.reduce((acc, log) => acc + (log.total_hours || 0), 0) || 0;

    setStats({
      myTasks,
      completedTasks,
      inProgressTasks,
      totalHours,
    });
  };

  const getRoleBadge = () => {
    if (userProfile?.role === 'student') {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          Student
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        Garden Worker
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-green-600" />
            <h1 className="text-xl font-semibold">NUST Garden - My Dashboard</h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Welcome, {userProfile?.full_name}
            </div>
            {getRoleBadge()}
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
              <CardTitle className="text-sm font-medium">My Tasks</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.myTasks}</div>
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
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Play className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.inProgressTasks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.totalHours.toFixed(1)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tasks">My Tasks</TabsTrigger>
            <TabsTrigger value="time">Time Tracking</TabsTrigger>
            <TabsTrigger value="reports">Submit Reports</TabsTrigger>
            <TabsTrigger value="request">Request Task</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <TaskList userRole={userProfile?.role || 'student'} />
          </TabsContent>

          <TabsContent value="time">
            <TimeLogger />
          </TabsContent>

          <TabsContent value="reports">
            <ReportSubmission />
          </TabsContent>

          <TabsContent value="request">
            <RequestTask />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}