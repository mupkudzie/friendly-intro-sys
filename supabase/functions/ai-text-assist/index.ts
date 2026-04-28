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

    // Global rule: ALL outputs must be short and precise.
    const BREVITY = `STRICT RULES:
- Be SHORT and PRECISE. Maximum 2-3 short sentences (≤ 50 words total).
- No filler, no headings, no bullet lists unless absolutely needed (max 3 bullets, ≤8 words each).
- Plain professional tone. No greetings, no sign-offs, no "Sure!" / "Here is".
- Return ONLY the requested text. Nothing else.`;

    switch (type) {
      case "improve":
        systemPrompt = `Farm task writing assistant. Improve clarity and grammar without changing meaning.\n${BREVITY}`;
        userPrompt = `Improve:\n"${text}"`;
        break;

      case "expand":
        systemPrompt = `Farm task writing assistant. Turn brief notes into a clear, concrete description.\n${BREVITY}`;
        userPrompt = `Expand briefly:\n"${text}"`;
        break;

      case "report":
        systemPrompt = `Farm task report assistant. Output a tight summary: what was done, any issues, outcome.\n${BREVITY}`;
        userPrompt = context
          ? `Refine this report for "${context}":\n"${text}"`
          : `Refine this report:\n"${text}"`;
        break;

      case "justification":
        systemPrompt = `Farm task request assistant. Write a compact justification: need + benefit.\n${BREVITY}`;
        userPrompt = context
          ? `Refine justification for "${context}":\n"${text}"`
          : `Refine justification:\n"${text}"`;
        break;

      case "suggest":
        systemPrompt = `Farm task writing assistant. Suggest a brief continuation that fits the context.\n${BREVITY}`;
        userPrompt = `Field: ${context || "description"}. Current: "${text}". Suggest a short completion.`;
        break;

      default:
        systemPrompt = `Writing assistant. Improve clarity.\n${BREVITY}`;
        userPrompt = `Improve:\n"${text}"`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 180,
        temperature: 0.4,
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
