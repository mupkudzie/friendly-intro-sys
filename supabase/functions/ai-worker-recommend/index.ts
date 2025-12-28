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
    const { taskTitle, taskDescription, taskPriority } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all approved workers/students
    const { data: workers, error: workersError } = await supabase
      .from('profiles')
      .select('user_id, full_name, department, role')
      .eq('approval_status', 'approved')
      .eq('is_deleted', false)
      .in('role', ['student', 'garden_worker']);

    if (workersError) throw workersError;

    // Get task history for each worker
    const workerStats = await Promise.all((workers || []).map(async (worker) => {
      // Get completed tasks count
      const { count: completedTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', worker.user_id)
        .eq('status', 'approved');

      // Get current pending/in-progress tasks
      const { count: activeTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', worker.user_id)
        .in('status', ['pending', 'in_progress']);

      // Get performance evaluations
      const { data: evaluations } = await supabase
        .from('performance_evaluations')
        .select('score')
        .eq('worker_id', worker.user_id);

      const avgScore = evaluations && evaluations.length > 0
        ? evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
        : 0;

      // Get total hours worked
      const { data: analytics } = await supabase
        .from('worker_analytics')
        .select('hours_accumulated, tasks_completed')
        .eq('worker_id', worker.user_id);

      const totalHours = analytics?.reduce((sum, a) => sum + Number(a.hours_accumulated), 0) || 0;

      // Get similar tasks completed (by matching keywords in title/description)
      const keywords = `${taskTitle} ${taskDescription}`.toLowerCase().split(' ')
        .filter(w => w.length > 3);
      
      const { data: similarTasks } = await supabase
        .from('tasks')
        .select('title, description')
        .eq('assigned_to', worker.user_id)
        .eq('status', 'approved');

      let similarityScore = 0;
      if (similarTasks) {
        similarTasks.forEach(task => {
          const taskText = `${task.title} ${task.description}`.toLowerCase();
          keywords.forEach(keyword => {
            if (taskText.includes(keyword)) similarityScore += 1;
          });
        });
      }

      return {
        ...worker,
        completedTasks: completedTasks || 0,
        activeTasks: activeTasks || 0,
        avgScore,
        totalHours,
        similarityScore,
      };
    }));

    // Use AI to rank workers
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const prompt = `You are a task assignment AI. Based on the following data, recommend the top 3 workers for this task.

Task Details:
- Title: ${taskTitle}
- Description: ${taskDescription}
- Priority: ${taskPriority}

Workers Data:
${workerStats.map(w => `
- ${w.full_name} (${w.role}, ${w.department || 'No department'})
  * Completed Tasks: ${w.completedTasks}
  * Active Tasks: ${w.activeTasks}
  * Avg Performance Score: ${w.avgScore.toFixed(1)}/5
  * Total Hours: ${w.totalHours}
  * Similarity to this task: ${w.similarityScore}
`).join('')}

Consider:
1. Availability (fewer active tasks = more available)
2. Experience (completed tasks and hours)
3. Performance (higher score = better)
4. Relevance (similarity score = experience with similar tasks)
5. For urgent tasks, prioritize experienced workers

Return a JSON array with exactly 3 workers (or fewer if less available), each with:
- user_id: string
- full_name: string
- reason: string (1-2 sentences explaining why)
- score: number (0-100 recommendation score)

Return ONLY the JSON array, no other text.`;

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
      // Fallback to simple scoring
      const ranked = workerStats
        .map(w => ({
          user_id: w.user_id,
          full_name: w.full_name,
          reason: `${w.completedTasks} completed tasks, ${w.activeTasks} active tasks`,
          score: Math.min(100, (w.completedTasks * 5) + (w.avgScore * 10) - (w.activeTasks * 15) + (w.similarityScore * 3)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return new Response(JSON.stringify({ recommendations: ranked }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResponse.json();
    let recommendations;
    
    try {
      const content = data.choices[0].message.content;
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      recommendations = workerStats
        .map(w => ({
          user_id: w.user_id,
          full_name: w.full_name,
          reason: `${w.completedTasks} completed tasks, ${w.activeTasks} active tasks`,
          score: Math.min(100, (w.completedTasks * 5) + (w.avgScore * 10) - (w.activeTasks * 15)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    }

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-worker-recommend:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
