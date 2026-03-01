import { supabase } from './supabase';

export interface WhatsAppNotificationParams {
  phone: string;
  templateKey: string;
  variables: Record<string, any>;
  applicantId?: string;
}

export interface WhatsAppTemplate {
  id: string;
  template_key: string;
  template_name: string;
  message_body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppLog {
  id: string;
  recipient_phone: string;
  recipient_name: string | null;
  message_type: string;
  message_body: string;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  applicant_id: string | null;
  sent_by: string | null;
  sent_at: string | null;
  retry_count: number;
  created_at: string;
}

export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }

  return cleaned;
}

export function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('08')) {
    return cleaned.length >= 10 && cleaned.length <= 13;
  } else if (cleaned.startsWith('628')) {
    return cleaned.length >= 11 && cleaned.length <= 14;
  }

  return false;
}

export async function isWhatsAppEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'fonnte_enabled')
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    return data.value === true;
  } catch (error) {
    console.error('Error checking WhatsApp enabled status:', error);
    return false;
  }
}

export async function getWhatsAppTemplate(templateKey: string): Promise<WhatsAppTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('template_key', templateKey)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching WhatsApp template:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching WhatsApp template:', error);
    return null;
  }
}

export async function getAllWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('template_name');

    if (error) {
      console.error('Error fetching WhatsApp templates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching WhatsApp templates:', error);
    return [];
  }
}

export function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), String(value || ''));
  }

  return result;
}

export async function sendWhatsAppNotification(params: WhatsAppNotificationParams): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const enabled = await isWhatsAppEnabled();
    if (!enabled) {
      console.log('WhatsApp notifications are disabled');
      return {
        success: false,
        message: 'WhatsApp notifications are currently disabled'
      };
    }

    const formattedPhone = formatPhoneNumber(params.phone);

    if (!validatePhoneNumber(params.phone)) {
      return {
        success: false,
        error: 'Invalid phone number format'
      };
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
      return {
        success: false,
        error: 'Not authenticated'
      };
    }

    const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/whatsapp/send`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        templateKey: params.templateKey,
        variables: params.variables,
        applicantId: params.applicantId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to send WhatsApp notification'
      };
    }

    return {
      success: result.success,
      message: result.message,
      error: result.error
    };
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send WhatsApp notification'
    };
  }
}

export async function getWhatsAppLogs(applicantId?: string, limit: number = 10): Promise<WhatsAppLog[]> {
  try {
    let query = supabase
      .from('whatsapp_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (applicantId) {
      query = query.eq('applicant_id', applicantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching WhatsApp logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching WhatsApp logs:', error);
    return [];
  }
}

export async function getWhatsAppStats(period: 'today' | 'week' | 'month' = 'today'): Promise<{
  total: number;
  sent: number;
  failed: number;
  successRate: number;
}> {
  try {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const { data, error } = await supabase
      .from('whatsapp_logs')
      .select('status')
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('Error fetching WhatsApp stats:', error);
      return { total: 0, sent: 0, failed: 0, successRate: 0 };
    }

    const total = data?.length || 0;
    const sent = data?.filter(log => log.status === 'sent').length || 0;
    const failed = data?.filter(log => log.status === 'failed').length || 0;
    const successRate = total > 0 ? (sent / total) * 100 : 0;

    return { total, sent, failed, successRate };
  } catch (error) {
    console.error('Error fetching WhatsApp stats:', error);
    return { total: 0, sent: 0, failed: 0, successRate: 0 };
  }
}

export async function retryFailedNotification(logId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const { data: log, error: logError } = await supabase
      .from('whatsapp_logs')
      .select('*')
      .eq('id', logId)
      .maybeSingle();

    if (logError || !log) {
      return {
        success: false,
        error: 'Notification log not found'
      };
    }

    if (log.status !== 'failed') {
      return {
        success: false,
        error: 'Can only retry failed notifications'
      };
    }

    const templateKey = log.message_type;
    const phone = log.recipient_phone;
    const applicantId = log.applicant_id;

    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('template_key', templateKey)
      .maybeSingle();

    if (!template) {
      return {
        success: false,
        error: 'Template not found'
      };
    }

    const variables: Record<string, any> = {};
    if (log.recipient_name) {
      variables.nama_lengkap = log.recipient_name;
    }

    await supabase
      .from('whatsapp_logs')
      .update({ retry_count: log.retry_count + 1 })
      .eq('id', logId);

    return await sendWhatsAppNotification({
      phone,
      templateKey,
      variables,
      applicantId: applicantId || undefined
    });
  } catch (error) {
    console.error('Error retrying notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry notification'
    };
  }
}
