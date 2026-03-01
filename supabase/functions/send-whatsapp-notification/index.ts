import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationRequest {
  phone: string;
  templateKey: string;
  variables: Record<string, any>;
  applicantId?: string;
}

interface WhatsAppTemplate {
  template_key: string;
  template_name: string;
  message_body: string;
  variables: string[];
  is_active: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { phone, templateKey, variables, applicantId }: NotificationRequest = await req.json();

    if (!phone || !templateKey) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, templateKey" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: config } = await supabase
      .from("app_config")
      .select("key, value")
      .in("key", ["fonnte_api_token", "fonnte_country_code", "fonnte_enabled"]);

    const configMap = new Map(config?.map(c => [c.key, c.value]) || []);
    const fonnte_enabled = configMap.get("fonnte_enabled");
    const fonnte_api_token = configMap.get("fonnte_api_token");
    const fonnte_country_code = configMap.get("fonnte_country_code") || "62";

    if (!fonnte_enabled || fonnte_enabled === false) {
      console.log("WhatsApp notifications are disabled");
      return new Response(
        JSON.stringify({ success: false, message: "WhatsApp notifications are disabled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!fonnte_api_token || fonnte_api_token === "") {
      console.error("Fonnte API token not configured");
      return new Response(
        JSON.stringify({ error: "WhatsApp API not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: template, error: templateError } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("template_key", templateKey)
      .eq("is_active", true)
      .maybeSingle();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: `Template '${templateKey}' not found or inactive` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let messageBody = template.message_body;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      messageBody = messageBody.replace(new RegExp(placeholder, "g"), String(value || ""));
    }

    const formattedPhone = formatPhoneNumber(phone, String(fonnte_country_code));

    const logId = crypto.randomUUID();
    await supabase.from("whatsapp_logs").insert({
      id: logId,
      recipient_phone: formattedPhone,
      recipient_name: variables.nama_lengkap || variables.full_name || "Unknown",
      message_type: templateKey,
      message_body: messageBody,
      status: "pending",
      applicant_id: applicantId || null,
      sent_by: user.id,
      created_at: new Date().toISOString(),
    });

    try {
      const fonnte_response = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          "Authorization": String(fonnte_api_token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: formattedPhone,
          message: messageBody,
          countryCode: String(fonnte_country_code),
        }),
      });

      const fonnte_result = await fonnte_response.json();

      if (fonnte_response.ok && fonnte_result.status !== false) {
        await supabase
          .from("whatsapp_logs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", logId);

        return new Response(
          JSON.stringify({ success: true, message: "WhatsApp notification sent successfully" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        const errorMessage = fonnte_result.reason || fonnte_result.message || "Unknown error from Fonnte API";
        await supabase
          .from("whatsapp_logs")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", logId);

        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (apiError) {
      const errorMsg = apiError instanceof Error ? apiError.message : "Failed to send WhatsApp message";
      await supabase
        .from("whatsapp_logs")
        .update({
          status: "failed",
          error_message: errorMsg,
        })
        .eq("id", logId);

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error in send-whatsapp-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function formatPhoneNumber(phone: string, countryCode: string): string {
  let cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.startsWith("0")) {
    cleaned = countryCode + cleaned.substring(1);
  } else if (!cleaned.startsWith(countryCode)) {
    cleaned = countryCode + cleaned;
  }
  
  return cleaned;
}
