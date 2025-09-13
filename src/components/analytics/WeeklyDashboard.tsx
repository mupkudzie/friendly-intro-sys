import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Clock, CheckCircle, Star, Target } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface WeeklyStats {
  tasks_completed: number;
  hours_accumulated: number;
  productivity_score: number;
  total_hours: number;
  avg_evaluation_score: number;
  program_progress: number;
}

export function WeeklyDashboard() {
  const { userProfile } = useAuth();
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      fetchWeeklyStats();
    }
  }, [userProfile]);

  const fetchWeeklyStats = async () => {
    if (!userProfile) return;

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    // Get weekly analytics
    const { data: weeklyData } = await supabase
      .from('worker_analytics')
      .select('*')
      .eq('worker_id', userProfile.user_id)
      .eq('week_start', format(weekStart, 'yyyy-MM-dd'))
      .single();

    // Get total hours for program progress
    const { data: totalHoursData } = await supabase
      .from('time_logs')
      .select('total_hours')
      .eq('user_id', userProfile.user_id);

    // Get average evaluation score
    const { data: evaluationsData } = await supabase
      .from('performance_evaluations')
      .select('score')
      .eq('worker_id', userProfile.user_id);

    const totalHours = totalHoursData?.reduce((sum, log) => sum + (log.total_hours || 0), 0) || 0;
    const avgScore = evaluationsData?.length > 0 
      ? evaluationsData.reduce((sum, evaluation) => sum + evaluation.score, 0) / evaluationsData.length 
      : 0;

    const stats: WeeklyStats = {
      tasks_completed: weeklyData?.tasks_completed || 0,
      hours_accumulated: weeklyData?.hours_accumulated || 0,
      productivity_score: weeklyData?.productivity_score || 0,
      total_hours: totalHours,
      avg_evaluation_score: avgScore,
      program_progress: Math.min((totalHours / 200) * 100, 100)
    };

    setWeeklyStats(stats);
    setLoading(false);
  };

  if (loading || !weeklyStats) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading weekly dashboard...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Weekly Performance Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <CheckCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">
                {weeklyStats.tasks_completed}
              </div>
              <div className="text-sm text-blue-700">Tasks Completed</div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Clock className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">
                {weeklyStats.hours_accumulated}
              </div>
              <div className="text-sm text-green-700">Hours This Week</div>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Star className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-600">
                {weeklyStats.avg_evaluation_score.toFixed(1)}/10
              </div>
              <div className="text-sm text-purple-700">Avg Rating</div>
            </div>

            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <Target className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-600">
                {weeklyStats.total_hours}h
              </div>
              <div className="text-sm text-orange-700">Total Hours</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Program Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Hours Completed</span>
                <span className="text-sm text-muted-foreground">
                  {weeklyStats.total_hours}/200 hours
                </span>
              </div>
              <Progress value={weeklyStats.program_progress} className="h-3" />
              <div className="text-right mt-1">
                <Badge variant={weeklyStats.program_progress >= 100 ? "default" : "secondary"}>
                  {weeklyStats.program_progress.toFixed(1)}% Complete
                </Badge>
              </div>
            </div>

            {weeklyStats.program_progress >= 100 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Program Completed!</span>
                </div>
                <p className="text-green-700 text-sm mt-1">
                  Congratulations! You have successfully completed the 200-hour program.
                </p>
              </div>
            )}

            {weeklyStats.program_progress < 100 && (
              <div className="text-sm text-muted-foreground">
                {200 - weeklyStats.total_hours} hours remaining to complete the program
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}