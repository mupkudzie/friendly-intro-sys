import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch comprehensive data for analysis
    const [
      { data: workers },
      { data: tasks },
      { data: timeLogs },
      { data: evaluations },
      { data: analytics },
    ] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, role, department, created_at')
        .in('role', ['student', 'garden_worker']).eq('approval_status', 'approved'),
      supabase.from('tasks').select('id, title, status, priority, assigned_to, created_at, updated_at'),
      supabase.from('time_logs').select('user_id, total_hours, created_at'),
      supabase.from('performance_evaluations').select('worker_id, score, feedback, created_at'),
      supabase.from('worker_analytics').select('worker_id, week_start, tasks_completed, hours_accumulated'),
    ]);

    // Calculate metrics
    const workerStats = (workers || []).map(worker => {
      const workerTasks = tasks?.filter(t => t.assigned_to === worker.user_id) || [];
      const completed = workerTasks.filter(t => t.status === 'approved' || t.status === 'completed').length;
      const pending = workerTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
      const workerHours = timeLogs?.filter(t => t.user_id === worker.user_id)
        .reduce((sum, t) => sum + (t.total_hours || 0), 0) || 0;
      const workerEvals = evaluations?.filter(e => e.worker_id === worker.user_id) || [];
      const avgScore = workerEvals.length > 0 
        ? workerEvals.reduce((sum, e) => sum + e.score, 0) / workerEvals.length : 0;

      return {
        name: worker.full_name,
        department: worker.department || 'Unassigned',
        completedTasks: completed,
        pendingTasks: pending,
        totalHours: workerHours,
        avgScore,
        completionRate: workerTasks.length > 0 ? (completed / workerTasks.length * 100).toFixed(1) : 0,
      };
    });

    // Calculate overall trends
    const totalCompleted = tasks?.filter(t => t.status === 'approved' || t.status === 'completed').length || 0;
    const totalPending = tasks?.filter(t => t.status === 'pending').length || 0;
    const totalInProgress = tasks?.filter(t => t.status === 'in_progress').length || 0;
    const totalHours = timeLogs?.reduce((sum, t) => sum + (t.total_hours || 0), 0) || 0;
    const avgPerformance = evaluations && evaluations.length > 0
      ? evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length : 0;

    // Calculate weekly trends
    const weeklyData = analytics?.reduce((acc: any, curr) => {
      const week = curr.week_start;
      if (!acc[week]) {
        acc[week] = { tasks: 0, hours: 0 };
      }
      acc[week].tasks += curr.tasks_completed;
      acc[week].hours += curr.hours_accumulated;
      return acc;
    }, {}) || {};

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const prompt = `You are an AI performance analyst for a garden/farm worker management system. Analyze this data and provide actionable insights.

## Worker Statistics:
${workerStats.slice(0, 15).map(w => 
  `- ${w.name}: ${w.completedTasks} completed, ${w.pendingTasks} pending, ${w.totalHours}h worked, Score: ${w.avgScore.toFixed(1)}/5, Rate: ${w.completionRate}%`
).join('\n')}

## Overall Metrics:
- Total Workers: ${workers?.length || 0}
- Tasks Completed: ${totalCompleted}
- Tasks Pending: ${totalPending}
- Tasks In Progress: ${totalInProgress}
- Total Hours Logged: ${totalHours.toFixed(1)}
- Average Performance Score: ${avgPerformance.toFixed(2)}/5

## Weekly Trend Data:
${Object.entries(weeklyData).slice(-4).map(([week, data]: [string, any]) => 
  `- Week of ${week}: ${data.tasks} tasks, ${data.hours}h`
).join('\n') || 'No weekly data available'}

Provide analysis in JSON format with these fields:
{
  "overallHealthScore": number (0-100),
  "productivityTrend": "increasing" | "stable" | "decreasing",
  "keyInsights": [
    { "type": "positive" | "warning" | "critical", "title": string, "description": string }
  ],
  "recommendations": [
    { "priority": "high" | "medium" | "low", "action": string, "impact": string }
  ],
  "topPerformers": [{ "name": string, "achievement": string }],
  "needsAttention": [{ "name": string, "issue": string, "suggestion": string }],
  "weeklyForecast": string
}

Return ONLY the JSON object, no other text. Limit to 3-5 items per array.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', await aiResponse.text());
      return new Response(JSON.stringify({
        overallHealthScore: Math.min(100, Math.round((totalCompleted / Math.max(1, totalCompleted + totalPending)) * 100)),
        productivityTrend: 'stable',
        keyInsights: [{ type: 'positive', title: 'System Active', description: `${workers?.length || 0} workers registered` }],
        recommendations: [{ priority: 'medium', action: 'Continue monitoring', impact: 'Maintain productivity' }],
        topPerformers: workerStats.slice(0, 3).map(w => ({ name: w.name, achievement: `${w.completedTasks} tasks` })),
        needsAttention: [],
        weeklyForecast: 'Unable to generate forecast',
        rawStats: { workerStats: workerStats.slice(0, 10), totalCompleted, totalPending, totalHours, avgPerformance }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResponse.json();
    let insights;

    try {
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      insights = {
        overallHealthScore: 75,
        productivityTrend: 'stable',
        keyInsights: [],
        recommendations: [],
        topPerformers: [],
        needsAttention: [],
        weeklyForecast: 'Analysis unavailable'
      };
    }

    // Add raw stats for charts
    insights.rawStats = {
      workerStats: workerStats.slice(0, 10),
      totalCompleted,
      totalPending,
      totalInProgress,
      totalHours,
      avgPerformance,
      weeklyData: Object.entries(weeklyData).slice(-8).map(([week, data]: [string, any]) => ({
        week: week.slice(5), // MM-DD format
        tasks: data.tasks,
        hours: data.hours,
      })),
    };

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-performance-insights:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
