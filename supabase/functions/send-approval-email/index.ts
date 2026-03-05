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

const getApprovedEmailHtml = (name: string, loginUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Approved</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🌿</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">FarmFlow</h1>
            </td>
          </tr>
          
          <!-- Success Icon -->
          <tr>
            <td style="padding: 40px 30px 20px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #dcfce7; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">✅</span>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 30px 30px; text-align: center;">
              <h2 style="color: #16a34a; margin: 0 0 15px; font-size: 24px;">Account Approved!</h2>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                Hi <strong>${name}</strong>,<br><br>
                Great news! Your account has been approved by the administrator. You now have full access to the FarmFlow Task Management System.
              </p>
              
              <!-- CTA Button -->
              <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.4);">
                Sign In Now →
              </a>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 25px;">
                Or copy this link: <a href="${loginUrl}" style="color: #16a34a;">${loginUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- What's Next Section -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; border-left: 4px solid #16a34a;">
                <h3 style="color: #15803d; margin: 0 0 10px; font-size: 16px;">What's Next?</h3>
                <ul style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Sign in to your dashboard</li>
                  <li>View and manage your assigned tasks</li>
                  <li>Track your work hours</li>
                  <li>Submit task reports</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px;">
                Best regards,<br>
                <strong>FarmFlow Admin Team</strong>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getRejectedEmailHtml = (name: string, reason?: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🌿</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">FarmFlow</h1>
            </td>
          </tr>
          
          <!-- Icon -->
          <tr>
            <td style="padding: 40px 30px 20px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #fef2f2; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">📋</span>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 30px 30px; text-align: center;">
              <h2 style="color: #374151; margin: 0 0 15px; font-size: 24px;">Registration Update</h2>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                Dear <strong>${name}</strong>,<br><br>
                We regret to inform you that your account registration was not approved at this time.
              </p>
              
              ${reason ? `
              <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; border-left: 4px solid #ef4444; text-align: left; margin-bottom: 25px;">
                <h3 style="color: #b91c1c; margin: 0 0 10px; font-size: 14px;">Reason:</h3>
                <p style="color: #374151; font-size: 14px; margin: 0;">${reason}</p>
              </div>
              ` : ''}
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you believe this was a mistake or have questions, please contact the system administrator for more information.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px;">
                Best regards,<br>
                <strong>FarmFlow Admin Team</strong>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, status, reason }: ApprovalEmailRequest = await req.json();
    
    console.log(`Processing ${status} email for ${name} (${email})`);

    // Get the origin URL for the login link
    const origin = req.headers.get("origin") || "https://aczdwxhjdaljeflbsmwo.lovable.app";
    const loginUrl = `${origin}/auth`;

    const subject = status === "approved" 
      ? "🎉 Account Approved - Welcome to FarmFlow" 
      : "📋 Account Registration Update - FarmFlow";

    const html = status === "approved"
      ? getApprovedEmailHtml(name, loginUrl)
      : getRejectedEmailHtml(name, reason);

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is not set; skipping email send.");
      return new Response(JSON.stringify({ skipped: true, message: "No API key configured" }), {
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
        from: "FarmFlow <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      }),
    }).then((r) => r.json());

    console.log("Email sent response:", emailResponse);

    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse);
      return new Response(JSON.stringify({ error: emailResponse.message || "Failed to send email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
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
