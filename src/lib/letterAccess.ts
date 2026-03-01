import { supabase } from './supabase';

export type AccessRule = 'always' | 'after_submission' | 'after_approval' | 'after_rejection';

export interface LetterTemplate {
  id: string;
  name: string;
  description: string | null;
  access_rule: AccessRule;
  is_available_for_students: boolean;
  is_active: boolean;
}

export interface GeneratedLetter {
  id: string;
  applicant_id: string;
  template_id: string;
  letter_number: string;
  pdf_url: string;
  generated_at: string;
  downloaded_at: string | null;
  download_count: number;
  template: LetterTemplate;
}

export interface ApplicantStatus {
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
}

export function canAccessLetter(
  accessRule: AccessRule,
  applicantStatus: 'draft' | 'submitted' | 'approved' | 'rejected'
): boolean {
  switch (accessRule) {
    case 'always':
      return true;
    case 'after_submission':
      return applicantStatus !== 'draft';
    case 'after_approval':
      return applicantStatus === 'approved';
    case 'after_rejection':
      return applicantStatus === 'rejected';
    default:
      return false;
  }
}

export async function getAvailableLettersForStudent(userId: string) {
  const { data: applicant, error: applicantError } = await supabase
    .from('applicants')
    .select('id, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (applicantError || !applicant) {
    return { data: null, error: applicantError || new Error('Applicant not found') };
  }

  const { data: generatedLetters, error: lettersError } = await supabase
    .from('generated_letters')
    .select(`
      id,
      applicant_id,
      template_id,
      letter_number,
      pdf_url,
      generated_at,
      downloaded_at,
      download_count,
      template:letter_templates!generated_letters_template_id_fkey (
        id,
        name,
        description,
        access_rule,
        is_available_for_students,
        is_active
      )
    `)
    .eq('applicant_id', applicant.id)
    .order('generated_at', { ascending: false });

  if (lettersError) {
    return { data: null, error: lettersError };
  }

  const availableLetters = (generatedLetters as unknown as GeneratedLetter[]).filter((letter) => {
    if (!letter.template) return false;
    if (!letter.template.is_available_for_students) return false;
    if (!letter.template.is_active) return false;

    return canAccessLetter(letter.template.access_rule, applicant.status);
  });

  return {
    data: {
      letters: availableLetters,
      applicantStatus: applicant.status
    },
    error: null
  };
}

export async function trackLetterDownload(letterId: string) {
  const { error } = await supabase.rpc('track_letter_download', {
    letter_id: letterId
  });

  if (error) {
    const { error: updateError } = await supabase
      .from('generated_letters')
      .update({
        downloaded_at: new Date().toISOString(),
        download_count: supabase.raw('download_count + 1')
      })
      .eq('id', letterId);

    return { error: updateError };
  }

  return { error: null };
}

export function getAccessRuleLabel(accessRule: AccessRule): string {
  const labels: Record<AccessRule, string> = {
    always: 'Tersedia Segera',
    after_submission: 'Setelah Submit Pendaftaran',
    after_approval: 'Setelah Disetujui',
    after_rejection: 'Setelah Ditolak'
  };
  return labels[accessRule] || accessRule;
}

export function getAccessRuleDescription(accessRule: AccessRule): string {
  const descriptions: Record<AccessRule, string> = {
    always: 'Surat dapat diunduh segera setelah dibuat oleh admin',
    after_submission: 'Surat dapat diunduh setelah siswa mengirim formulir pendaftaran',
    after_approval: 'Surat hanya dapat diunduh setelah pendaftaran disetujui',
    after_rejection: 'Surat hanya dapat diunduh setelah pendaftaran ditolak'
  };
  return descriptions[accessRule] || accessRule;
}
