import { supabase } from './supabase';
import { format } from 'date-fns';

export interface SendNotificationParams {
  phone: string;
  templateKey: string;
  variables: Record<string, any>;
  applicantId?: string;
}

export async function sendWhatsAppNotification(params: SendNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[WhatsApp] Sending notification:', params.templateKey);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('[WhatsApp] No active session');
      return { success: false, error: 'No active session' };
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp-notification`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('[WhatsApp] Notification failed:', result.error);
      return { success: false, error: result.error };
    }

    console.log('[WhatsApp] Notification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[WhatsApp] Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function sendExamSubmittedNotification(attemptId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[ExamNotification] Sending exam submitted notification for attempt:', attemptId);

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .select(`
        *,
        exam:exams!inner(title),
        applicant:applicants!inner(
          id,
          dynamic_data,
          registration_number,
          user_id
        )
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      console.error('[ExamNotification] Failed to fetch attempt:', attemptError);
      return { success: false, error: 'Failed to fetch attempt data' };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', attempt.applicant.user_id)
      .single();

    if (profileError || !profile?.phone_number) {
      console.warn('[ExamNotification] No phone number found for user');
      return { success: false, error: 'No phone number found' };
    }

    const namaLengkap = attempt.applicant.dynamic_data?.nama_lengkap || 'Peserta';
    const tanggalSubmit = attempt.submitted_at
      ? format(new Date(attempt.submitted_at), 'dd/MM/yyyy HH:mm')
      : format(new Date(), 'dd/MM/yyyy HH:mm');

    return await sendWhatsAppNotification({
      phone: profile.phone_number,
      templateKey: 'exam_submitted',
      variables: {
        nama_lengkap: namaLengkap,
        exam_title: attempt.exam.title,
        tanggal_submit: tanggalSubmit,
        registration_number: attempt.applicant.registration_number || '-',
      },
      applicantId: attempt.applicant.id,
    });
  } catch (error) {
    console.error('[ExamNotification] Error in sendExamSubmittedNotification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function sendExamGradedNotification(attemptId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[ExamNotification] Sending exam graded notification for attempt:', attemptId);

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .select(`
        *,
        exam:exams!inner(title),
        applicant:applicants!inner(
          id,
          dynamic_data,
          registration_number,
          user_id
        )
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      console.error('[ExamNotification] Failed to fetch attempt:', attemptError);
      return { success: false, error: 'Failed to fetch attempt data' };
    }

    const { data: result, error: resultError } = await supabase
      .from('exam_results')
      .select('*')
      .eq('attempt_id', attemptId)
      .single();

    if (resultError || !result) {
      console.error('[ExamNotification] Failed to fetch result:', resultError);
      return { success: false, error: 'Failed to fetch result data' };
    }

    if (result.grading_status !== 'completed') {
      console.log('[ExamNotification] Grading not completed yet, skipping notification');
      return { success: false, error: 'Grading not completed' };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', attempt.applicant.user_id)
      .single();

    if (profileError || !profile?.phone_number) {
      console.warn('[ExamNotification] No phone number found for user');
      return { success: false, error: 'No phone number found' };
    }

    const namaLengkap = attempt.applicant.dynamic_data?.nama_lengkap || 'Peserta';
    const statusKelulusan = result.passed ? 'LULUS ✅' : 'TIDAK LULUS ❌';
    const percentage = Math.round(result.percentage * 10) / 10;

    return await sendWhatsAppNotification({
      phone: profile.phone_number,
      templateKey: 'exam_graded',
      variables: {
        nama_lengkap: namaLengkap,
        exam_title: attempt.exam.title,
        total_points: result.total_points,
        max_points: result.max_points,
        percentage: percentage,
        status_kelulusan: statusKelulusan,
      },
      applicantId: attempt.applicant.id,
    });
  } catch (error) {
    console.error('[ExamNotification] Error in sendExamGradedNotification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function sendDocumentsAvailableNotification(
  applicantId: string,
  documentCount?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[ExamNotification] Sending documents available notification for applicant:', applicantId);

    const { data: applicant, error: applicantError } = await supabase
      .from('applicants')
      .select('id, dynamic_data, status, user_id')
      .eq('id', applicantId)
      .single();

    if (applicantError || !applicant) {
      console.error('[ExamNotification] Failed to fetch applicant:', applicantError);
      return { success: false, error: 'Failed to fetch applicant data' };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', applicant.user_id)
      .single();

    if (profileError || !profile?.phone_number) {
      console.warn('[ExamNotification] No phone number found for user');
      return { success: false, error: 'No phone number found' };
    }

    let accessInstructions = '';
    if (applicant.status === 'approved') {
      accessInstructions = '🎉 Status Anda: DISETUJUI\nSemua dokumen pendaftaran sudah dapat diunduh.';
    } else if (applicant.status === 'submitted') {
      accessInstructions = '📋 Status Anda: DALAM PROSES\nDokumen yang tersedia dapat diunduh saat ini.';
    } else {
      accessInstructions = 'Silakan cek dashboard Anda untuk informasi lebih lanjut.';
    }

    let docCount = documentCount;
    if (docCount === undefined) {
      const { data: templates } = await supabase
        .from('letter_templates')
        .select('id, access_rule')
        .eq('is_active', true);

      docCount = templates?.filter(t => {
        if (t.access_rule === 'all') return true;
        if (t.access_rule === 'submitted' && ['submitted', 'approved', 'rejected'].includes(applicant.status)) return true;
        if (t.access_rule === 'approved' && applicant.status === 'approved') return true;
        return false;
      }).length || 0;
    }

    const namaLengkap = applicant.dynamic_data?.nama_lengkap || 'Peserta';

    return await sendWhatsAppNotification({
      phone: profile.phone_number,
      templateKey: 'documents_available',
      variables: {
        nama_lengkap: namaLengkap,
        document_count: docCount,
        access_instructions: accessInstructions,
      },
      applicantId: applicant.id,
    });
  } catch (error) {
    console.error('[ExamNotification] Error in sendDocumentsAvailableNotification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
