import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SendEmailRequest {
  interview_request_id: string;
  interviewer_id: string;
  interviewer_email: string;
  interviewer_name: string;
  student_name: string;
  registration_number: string;
  interview_date: string;
  interview_time: string;
  interview_type: string;
  meeting_link?: string;
  admin_notes?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: profile, error: profileError } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can send emails' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: SendEmailRequest = await req.json();
    const {
      interview_request_id,
      interviewer_id,
      interviewer_email,
      interviewer_name,
      student_name,
      registration_number,
      interview_date,
      interview_time,
      interview_type,
      meeting_link,
      admin_notes,
    } = body;

    if (!interviewer_email || !interviewer_name || !student_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: template } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('template_key', 'interview_assigned')
      .eq('is_active', true)
      .single();

    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Email template not found' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let subject = template.subject
      .replace(/\{\{interviewer_name\}\}/g, interviewer_name)
      .replace(/\{\{student_name\}\}/g, student_name)
      .replace(/\{\{registration_number\}\}/g, registration_number)
      .replace(/\{\{interview_date\}\}/g, interview_date)
      .replace(/\{\{interview_time\}\}/g, interview_time)
      .replace(/\{\{interview_type\}\}/g, interview_type);

    let htmlBody = template.html_body
      .replace(/\{\{interviewer_name\}\}/g, interviewer_name)
      .replace(/\{\{student_name\}\}/g, student_name)
      .replace(/\{\{registration_number\}\}/g, registration_number)
      .replace(/\{\{interview_date\}\}/g, interview_date)
      .replace(/\{\{interview_time\}\}/g, interview_time)
      .replace(/\{\{interview_type\}\}/g, interview_type);

    let textBody = template.text_body
      .replace(/\{\{interviewer_name\}\}/g, interviewer_name)
      .replace(/\{\{student_name\}\}/g, student_name)
      .replace(/\{\{registration_number\}\}/g, registration_number)
      .replace(/\{\{interview_date\}\}/g, interview_date)
      .replace(/\{\{interview_time\}\}/g, interview_time)
      .replace(/\{\{interview_type\}\}/g, interview_type);

    if (meeting_link) {
      htmlBody = htmlBody.replace(/\{\{#if meeting_link\}\}([\s\S]*?)\{\{\/#if\}\}/g, '$1')
        .replace(/\{\{meeting_link\}\}/g, meeting_link);
      textBody = textBody.replace(/\{\{#if meeting_link\}\}([\s\S]*?)\{\{\/#if\}\}/g, '$1')
        .replace(/\{\{meeting_link\}\}/g, meeting_link);
    } else {
      htmlBody = htmlBody.replace(/\{\{#if meeting_link\}\}[\s\S]*?\{\{\/#if\}\}/g, '');
      textBody = textBody.replace(/\{\{#if meeting_link\}\}[\s\S]*?\{\{\/#if\}\}/g, '');
    }

    if (admin_notes) {
      htmlBody = htmlBody.replace(/\{\{#if admin_notes\}\}([\s\S]*?)\{\{\/#if\}\}/g, '$1')
        .replace(/\{\{admin_notes\}\}/g, admin_notes);
      textBody = textBody.replace(/\{\{#if admin_notes\}\}([\s\S]*?)\{\{\/#if\}\}/g, '$1')
        .replace(/\{\{admin_notes\}\}/g, admin_notes);
    } else {
      htmlBody = htmlBody.replace(/\{\{#if admin_notes\}\}[\s\S]*?\{\{\/#if\}\}/g, '');
      textBody = textBody.replace(/\{\{#if admin_notes\}\}[\s\S]*?\{\{\/#if\}\}/g, '');
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      
      const { error: logError } = await supabaseAdmin
        .from('email_logs')
        .insert({
          recipient_email: interviewer_email,
          recipient_type: 'interviewer',
          email_type: 'interview_assigned',
          subject,
          status: 'failed',
          error_message: 'RESEND_API_KEY not configured',
          interview_request_id,
          sent_by: user.id,
        });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email service not configured. Please contact administrator.',
          logged: !logError
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') || 'noreply@example.com',
        to: [interviewer_email],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    const emailResult = await emailResponse.json();
    const emailSuccess = emailResponse.ok;

    const { error: logError } = await supabaseAdmin
      .from('email_logs')
      .insert({
        recipient_email: interviewer_email,
        recipient_type: 'interviewer',
        email_type: 'interview_assigned',
        subject,
        status: emailSuccess ? 'sent' : 'failed',
        error_message: emailSuccess ? null : JSON.stringify(emailResult),
        interview_request_id,
        sent_by: user.id,
        sent_at: emailSuccess ? new Date().toISOString() : null,
      });

    if (!emailSuccess) {
      console.error('Failed to send email:', emailResult);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send email',
          details: emailResult,
          logged: !logError
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let whatsappSuccess = false;
    let whatsappError = null;

    try {
      const { data: interviewerData } = await supabaseAdmin
        .from('interviewers')
        .select('phone, whatsapp_notifications, user_id')
        .eq('id', interviewer_id)
        .single();

      if (interviewerData?.phone && interviewerData?.whatsapp_notifications) {
        const { data: configData } = await supabaseAdmin
          .from('app_config')
          .select('key, value')
          .in('key', ['fonnte_api_token', 'fonnte_country_code', 'fonnte_enabled']);

        const configMap = new Map(configData?.map(c => [c.key, c.value]) || []);
        const fonnte_enabled = configMap.get('fonnte_enabled');
        const fonnte_api_token = configMap.get('fonnte_api_token');
        const fonnte_country_code = configMap.get('fonnte_country_code') || '62';

        if (fonnte_enabled === true && fonnte_api_token) {
          const whatsappMessage = `🎯 *Penugasan Interview Baru*\n\nHalo ${interviewer_name},\n\nAnda telah ditugaskan untuk melakukan interview dengan calon siswa:\n\n👤 *Nama Siswa:* ${student_name}\n📝 *No. Registrasi:* ${registration_number}\n📅 *Tanggal:* ${interview_date}\n⏰ *Waktu:* ${interview_time}\n📍 *Tipe:* ${interview_type}${meeting_link ? `\n🔗 *Link Meeting:* ${meeting_link}` : ''}${admin_notes ? `\n\n📌 *Catatan Admin:* ${admin_notes}` : ''}\n\nTerima kasih atas dedikasi Anda!`;

          const formattedPhone = formatPhoneNumber(interviewerData.phone, String(fonnte_country_code));

          const logId = crypto.randomUUID();
          await supabaseAdmin.from('whatsapp_logs').insert({
            id: logId,
            recipient_phone: formattedPhone,
            recipient_name: interviewer_name,
            message_type: 'interview_assigned',
            message_body: whatsappMessage,
            status: 'pending',
            interview_request_id: interview_request_id,
            recipient_user_id: interviewerData.user_id || null,
            sent_by: user.id,
            created_at: new Date().toISOString(),
          });

          try {
            const fonnte_response = await fetch('https://api.fonnte.com/send', {
              method: 'POST',
              headers: {
                'Authorization': String(fonnte_api_token),
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                target: formattedPhone,
                message: whatsappMessage,
                countryCode: String(fonnte_country_code),
              }),
            });

            const fonnte_result = await fonnte_response.json();

            if (fonnte_response.ok && fonnte_result.status !== false) {
              await supabaseAdmin
                .from('whatsapp_logs')
                .update({
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                })
                .eq('id', logId);

              whatsappSuccess = true;
              console.log('WhatsApp notification sent successfully to interviewer');
            } else {
              const errorMessage = fonnte_result.reason || fonnte_result.message || 'Unknown error from Fonnte API';
              whatsappError = errorMessage;
              await supabaseAdmin
                .from('whatsapp_logs')
                .update({
                  status: 'failed',
                  error_message: errorMessage,
                })
                .eq('id', logId);

              console.error('Failed to send WhatsApp notification:', errorMessage);
            }
          } catch (apiError) {
            const errorMsg = apiError instanceof Error ? apiError.message : 'Failed to send WhatsApp message';
            whatsappError = errorMsg;
            await supabaseAdmin
              .from('whatsapp_logs')
              .update({
                status: 'failed',
                error_message: errorMsg,
              })
              .eq('id', logId);

            console.error('Error calling Fonnte API:', apiError);
          }
        } else {
          console.log('WhatsApp notifications disabled or API token not configured');
        }
      } else {
        if (!interviewerData?.phone) {
          console.log('Interviewer phone number not found');
        } else if (!interviewerData?.whatsapp_notifications) {
          console.log('WhatsApp notifications disabled for this interviewer');
        }
      }
    } catch (whatsappErr) {
      console.error('Error sending WhatsApp notification:', whatsappErr);
      whatsappError = whatsappErr instanceof Error ? whatsappErr.message : 'Unknown error';
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        email_id: emailResult.id,
        logged: !logError,
        whatsapp_sent: whatsappSuccess,
        whatsapp_error: whatsappError
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function formatPhoneNumber(phone: string, countryCode: string): string {
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = countryCode + cleaned.substring(1);
  } else if (!cleaned.startsWith(countryCode)) {
    cleaned = countryCode + cleaned;
  }

  return cleaned;
}