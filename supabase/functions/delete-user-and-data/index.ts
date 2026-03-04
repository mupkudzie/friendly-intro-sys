import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin or supervisor
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Unauthorized");

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!callerProfile || !["admin", "supervisor"].includes(callerProfile.role)) {
      throw new Error("Unauthorized: insufficient permissions");
    }

    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    // Delete all related data
    await supabaseAdmin.from("task_comments").delete().eq("user_id", user_id);
    await supabaseAdmin.from("task_reports").delete().eq("user_id", user_id);
    await supabaseAdmin.from("task_history").delete().eq("user_id", user_id);
    await supabaseAdmin.from("activity_logs").delete().eq("user_id", user_id);
    await supabaseAdmin.from("time_logs").delete().eq("user_id", user_id);
    await supabaseAdmin.from("performance_evaluations").delete().eq("worker_id", user_id);
    await supabaseAdmin.from("worker_analytics").delete().eq("worker_id", user_id);
    await supabaseAdmin.from("notifications").delete().eq("recipient_id", user_id);
    await supabaseAdmin.from("task_requests").delete().eq("requested_by", user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    
    // Delete tasks assigned to user
    await supabaseAdmin.from("tasks").delete().eq("assigned_to", user_id);
    
    // Delete profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

    // Delete from auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authError) {
      console.error("Auth delete error:", authError);
    }

    // Log the deletion
    await supabaseAdmin.from("audit_logs").insert({
      user_id: caller.id,
      action: "Permanently deleted user",
      entity_type: "user",
      entity_id: user_id,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
