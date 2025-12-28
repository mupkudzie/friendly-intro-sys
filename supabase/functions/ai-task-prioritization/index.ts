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
    const { userId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all pending/in-progress tasks
    let tasksQuery = supabase
      .from('tasks')
      .select('id, title, description, priority, status, due_date, estimated_hours, location, assigned_to, created_at')
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false });

    if (userId) {
      tasksQuery = tasksQuery.eq('assigned_to', userId);
    }

    const { data: tasks, error: tasksError } = await tasksQuery;
    if (tasksError) throw tasksError;

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ 
        prioritizedTasks: [],
        message: 'No pending tasks to prioritize'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get worker names
    const workerIds = [...new Set(tasks.map(t => t.assigned_to))];
    const { data: workers } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', workerIds);

    const workerMap = new Map(workers?.map(w => [w.user_id, w.full_name]) || []);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const today = new Date().toISOString().split('T')[0];

    const prompt = `You are an AI task prioritization assistant for a garden/farm management system. Analyze these tasks and provide an optimized priority order.

Today's Date: ${today}

Tasks to Prioritize:
${tasks.map((t, i) => `
${i + 1}. ID: ${t.id}
   Title: ${t.title}
   Current Priority: ${t.priority}
   Status: ${t.status}
   Due Date: ${t.due_date || 'Not set'}
   Est. Hours: ${t.estimated_hours || 'Not set'}
   Location: ${t.location || 'Not specified'}
   Worker: ${workerMap.get(t.assigned_to) || 'Unassigned'}
   Created: ${t.created_at.split('T')[0]}
`).join('')}

Consider these factors when prioritizing:
1. Due date urgency (overdue tasks are critical)
2. Current priority level (urgent > high > medium > low)
3. Task dependencies (some tasks may need to be done before others)
4. Weather/seasonal considerations for garden tasks
5. Efficiency (group tasks by location)
6. Balance workload across workers

Return a JSON object with:
{
  "prioritizedTasks": [
    {
      "taskId": "uuid",
      "rank": number (1 = highest priority),
      "suggestedPriority": "urgent" | "high" | "medium" | "low",
      "reason": "Brief explanation",
      "urgencyScore": number (0-100)
    }
  ],
  "groupedByLocation": {
    "location_name": ["task_id_1", "task_id_2"]
  },
  "overdueTasks": ["task_id"],
  "recommendations": ["actionable suggestion"]
}

Return ONLY the JSON object.`;

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
      // Fallback to simple prioritization
      const prioritized = tasks.map((t, i) => {
        const priorityScore = { urgent: 100, high: 75, medium: 50, low: 25 }[t.priority] || 50;
        const dueScore = t.due_date 
          ? (new Date(t.due_date) < new Date() ? 100 : Math.max(0, 100 - Math.floor((new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))))
          : 0;
        return {
          taskId: t.id,
          rank: 0,
          suggestedPriority: t.priority,
          reason: 'Based on current priority',
          urgencyScore: Math.min(100, priorityScore + dueScore / 2),
          task: { ...t, workerName: workerMap.get(t.assigned_to) }
        };
      }).sort((a, b) => b.urgencyScore - a.urgencyScore)
        .map((t, i) => ({ ...t, rank: i + 1 }));

      return new Response(JSON.stringify({ 
        prioritizedTasks: prioritized,
        recommendations: ['Focus on urgent and high-priority tasks first']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResponse.json();
    let result;

    try {
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { prioritizedTasks: [] };
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      result = { prioritizedTasks: [], recommendations: [] };
    }

    // Enrich with full task data
    result.prioritizedTasks = (result.prioritizedTasks || []).map((pt: any) => {
      const task = tasks.find(t => t.id === pt.taskId);
      return {
        ...pt,
        task: task ? { ...task, workerName: workerMap.get(task.assigned_to) } : null
      };
    }).filter((pt: any) => pt.task);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-task-prioritization:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
