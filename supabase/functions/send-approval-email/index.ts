import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApprovalEmailRequest {
  email: string;
  name: string;
  status: "approved" | "rejected";
  reason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, status, reason }: ApprovalEmailRequest = await req.json();

    const subject = status === "approved" 
      ? "Account Approved - Welcome to NUST Garden System" 
      : "Account Registration Update";

    const html = status === "approved"
      ? `
        <h1>Welcome to NUST Garden System, ${name}!</h1>
        <p>Your account has been approved. You can now log in to the system.</p>
        <p>Please visit the login page to access your dashboard.</p>
        <p>Best regards,<br>NUST Garden Admin Team</p>
      `
      : `
        <h1>Account Registration Update</h1>
        <p>Dear ${name},</p>
        <p>We regret to inform you that your account registration was not approved.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>If you have any questions, please contact the administrator.</p>
        <p>Best regards,<br>NUST Garden Admin Team</p>
      `;

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not set; skipping email send.");
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NUST Garden <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      }),
    }).then((r) => r.json());

    console.log("Email sent response:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-approval-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
