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

    // Get recent completed/approved tasks to learn from
    const { data: recentTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('title, description, priority, estimated_hours, location, instructions')
      .in('status', ['approved', 'completed'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (tasksError) throw tasksError;

    // Get existing templates to avoid duplicates
    const { data: existingTemplates } = await supabase
      .from('task_templates')
      .select('title, category');

    const existingTitles = existingTemplates?.map(t => t.title.toLowerCase()) || [];
    const existingCategories = [...new Set(existingTemplates?.map(t => t.category) || [])];

    if (!recentTasks || recentTasks.length === 0) {
      return new Response(JSON.stringify({ 
        templates: [],
        message: 'No completed tasks to learn from yet'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const prompt = `You are a task template AI for a farm/garden work management system. Analyze these completed tasks and create reusable templates.

Recent Completed Tasks:
${recentTasks.map((t, i) => `
${i + 1}. Title: ${t.title}
   Description: ${t.description}
   Priority: ${t.priority}
   Est. Hours: ${t.estimated_hours || 'Not set'}
   Location: ${t.location || 'Not set'}
   Instructions: ${t.instructions || 'None'}
`).join('')}

Existing template titles (avoid duplicates): ${existingTitles.join(', ') || 'None'}
Existing categories: ${existingCategories.join(', ') || 'None'}

Create 3-5 NEW template suggestions based on common patterns you observe. For each template:
1. Generalize specific details (dates, names) into placeholders
2. Identify the category (e.g., Planting, Harvesting, Maintenance, Watering, Weeding, General)
3. Provide clear, reusable instructions

Return a JSON array with templates, each having:
- title: string (concise, general title)
- description: string (general description with [placeholders] for specifics)
- category: string
- priority: "low" | "medium" | "high"
- estimated_hours: number
- requirements: string (tools, skills, or prerequisites needed)

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
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      return new Response(JSON.stringify({ 
        error: 'AI service temporarily unavailable',
        templates: [] 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiResponse.json();
    let templates;

    try {
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      templates = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      // Filter out any that duplicate existing titles
      templates = templates.filter((t: any) => 
        !existingTitles.includes(t.title.toLowerCase())
      );
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      templates = [];
    }

    return new Response(JSON.stringify({ templates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-generate-templates:', error);
    return new Response(JSON.stringify({ error: error.message, templates: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
