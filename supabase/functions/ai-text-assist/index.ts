import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, type, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "improve":
        systemPrompt = `You are a helpful writing assistant for a farm/garden management application. 
Your task is to improve the user's text to be more professional, clear, and well-structured while maintaining their original meaning.
Keep the improved text concise and appropriate for a work context.
Only return the improved text, no explanations or additional commentary.`;
        userPrompt = `Improve this text:\n\n"${text}"`;
        break;

      case "expand":
        systemPrompt = `You are a helpful writing assistant for a farm/garden management application.
Your task is to expand the user's brief notes into a more detailed and comprehensive description.
Keep it professional and relevant to garden/farm work context.
Only return the expanded text, no explanations or additional commentary.`;
        userPrompt = `Expand this text into a more detailed description:\n\n"${text}"`;
        break;

      case "report":
        systemPrompt = `You are a helpful writing assistant for a farm/garden management application.
Your task is to help format and improve task completion reports.
Make the report clear, professional, and well-structured with proper grammar.
Include relevant details about work accomplished, challenges faced, and outcomes.
Only return the improved report text, no explanations.`;
        userPrompt = context 
          ? `Improve this task report for the task "${context}":\n\n"${text}"`
          : `Improve this task report:\n\n"${text}"`;
        break;

      case "justification":
        systemPrompt = `You are a helpful writing assistant for a farm/garden management application.
Your task is to help write compelling task request justifications.
Make the justification clear, professional, and persuasive.
Focus on why the task is needed and the benefits it will bring.
Only return the improved justification, no explanations.`;
        userPrompt = context
          ? `Improve this justification for requesting the task "${context}":\n\n"${text}"`
          : `Improve this task request justification:\n\n"${text}"`;
        break;

      case "suggest":
        systemPrompt = `You are a helpful writing assistant for a farm/garden management application.
Based on the context provided, suggest what the user might want to write.
Provide a concise, relevant suggestion that fits the farm/garden work context.
Only return the suggested text, no explanations.`;
        userPrompt = `The user is writing a ${context || "description"}. They've started with:\n\n"${text}"\n\nSuggest how they might complete or continue this.`;
        break;

      default:
        systemPrompt = `You are a helpful writing assistant. Improve the given text to be more clear and professional.`;
        userPrompt = `Improve this text:\n\n"${text}"`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact administrator." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to get AI response");
    }

    const data = await response.json();
    const improvedText = data.choices?.[0]?.message?.content || text;

    return new Response(
      JSON.stringify({ improvedText: improvedText.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI text assist error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
