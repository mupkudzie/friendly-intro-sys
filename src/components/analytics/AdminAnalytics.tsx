import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, CheckCircle, Clock, Activity, Target } from 'lucide-react';

interface AdminStats {
  total_workers: number;
  active_workers: number;
  total_tasks_completed: number;
  total_hours_logged: number;
  program_completions: number;
  avg_performance_score: number;
  worker_performance: Array<{
    name: string;
    tasks: number;
    hours: number;
    score: number;
  }>;
  task_completion_trend: Array<{
    week: string;
    completed: number;
  }>;
}

export function AdminAnalytics() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      // Get worker counts
      const { data: workersData } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .in('role', ['student', 'garden_worker']);

      // Get total tasks completed
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('status')
        .eq('status', 'completed');

      // Get total hours
      const { data: hoursData } = await supabase
        .from('time_logs')
        .select('total_hours');

      // Get program completions (workers with 200+ hours)
      const { data: programData } = await supabase
        .rpc('get_worker_total_hours' as any)
        .gte('total_hours', 200);

      // Get average performance scores
      const { data: performanceData } = await supabase
        .from('performance_evaluations')
        .select('score');

      // Get worker performance data
      const { data: workerPerformance } = await supabase
        .from('worker_analytics')
        .select('worker_id, tasks_completed, hours_accumulated');

      // Get worker names
      const { data: workersMap } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('role', ['student', 'garden_worker']);

      // Get active workers (those with tasks in progress)
      const { data: activeWorkersData } = await supabase
        .from('tasks')
        .select('assigned_to')
        .eq('status', 'in_progress');

      const totalWorkers = workersData?.length || 0;
      const activeWorkers = new Set(activeWorkersData?.map(t => t.assigned_to)).size;
      const totalTasksCompleted = tasksData?.length || 0;
      const totalHours = hoursData?.reduce((sum, log) => sum + (log.total_hours || 0), 0) || 0;
      const programCompletions = programData?.length || 0;
      const avgScore = performanceData?.length > 0 
        ? performanceData.reduce((sum, p) => sum + p.score, 0) / performanceData.length 
        : 0;

      // Create worker name lookup
      const workerNameMap = new Map();
      workersMap?.forEach(w => {
        workerNameMap.set(w.user_id, w.full_name);
      });

      // Process worker performance data
      const workerPerformanceMap = new Map();
      workerPerformance?.forEach(wp => {
        const workerId = wp.worker_id;
        if (!workerPerformanceMap.has(workerId)) {
          workerPerformanceMap.set(workerId, {
            name: workerNameMap.get(workerId) || 'Unknown',
            tasks: 0,
            hours: 0,
            score: 0
          });
        }
        const worker = workerPerformanceMap.get(workerId);
        worker.tasks += wp.tasks_completed;
        worker.hours += wp.hours_accumulated;
      });

      const stats: AdminStats = {
        total_workers: totalWorkers,
        active_workers: activeWorkers,
        total_tasks_completed: totalTasksCompleted,
        total_hours_logged: totalHours,
        program_completions: programCompletions,
        avg_performance_score: avgScore,
        worker_performance: Array.from(workerPerformanceMap.values()).slice(0, 10),
        task_completion_trend: [] // Would need more complex query for trend data
      };

      setStats(stats);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.total_workers}</div>
            <div className="text-sm text-muted-foreground">Total Workers</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.active_workers}</div>
            <div className="text-sm text-muted-foreground">Active Workers</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.total_tasks_completed}</div>
            <div className="text-sm text-muted-foreground">Tasks Completed</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{Math.round(stats.total_hours_logged)}</div>
            <div className="text-sm text-muted-foreground">Total Hours</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.program_completions}</div>
            <div className="text-sm text-muted-foreground">Program Completions</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.avg_performance_score.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Avg Performance</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Worker Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.worker_performance.slice(0, 5).map((worker, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">{worker.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {worker.tasks} tasks • {worker.hours}h
                    </div>
                  </div>
                  <Badge variant="outline">
                    Score: {worker.score}/10
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Worker Engagement</span>
                <span className="text-sm text-muted-foreground">
                  {stats.active_workers}/{stats.total_workers}
                </span>
              </div>
              <Progress 
                value={(stats.active_workers / stats.total_workers) * 100} 
                className="h-3" 
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Program Completion Rate</span>
                <span className="text-sm text-muted-foreground">
                  {stats.program_completions}/{stats.total_workers}
                </span>
              </div>
              <Progress 
                value={(stats.program_completions / stats.total_workers) * 100} 
                className="h-3" 
              />
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-lg font-semibold text-green-800">
                {((stats.active_workers / stats.total_workers) * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-green-700">Workers Currently Active</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}