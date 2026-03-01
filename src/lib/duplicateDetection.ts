import { supabase } from './supabase';
import { FIELD_NAMES, getFieldValue } from './fieldConstants';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  message?: string;
  existingApplicantId?: string;
}

export const checkEmailDuplicate = async (
  email: string,
  excludeUserId?: string
): Promise<DuplicateCheckResult> => {
  try {
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error checking email duplicate:', authError);
      return { isDuplicate: false };
    }

    const duplicate = authUsers.users.find(
      user => user.email?.toLowerCase() === email.toLowerCase() && user.id !== excludeUserId
    );

    if (duplicate) {
      return {
        isDuplicate: true,
        message: 'Email sudah terdaftar'
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking email duplicate:', error);
    return { isDuplicate: false };
  }
};

export const checkPhoneDuplicate = async (
  phone: string,
  excludeUserId?: string
): Promise<DuplicateCheckResult> => {
  try {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    const { data: applicants, error } = await supabase
      .from('applicants')
      .select('id, user_id, dynamic_data')
      .neq('user_id', excludeUserId || 'none');

    if (error) {
      console.error('Error checking phone duplicate:', error);
      return { isDuplicate: false };
    }

    const duplicate = applicants?.find(applicant => {
      // Use standard field name with fallback to legacy field names
      const applicantPhone = getFieldValue(applicant.dynamic_data, FIELD_NAMES.NO_TELEPON);
      if (!applicantPhone) return false;

      const cleanApplicantPhone = applicantPhone.replace(/[\s\-\(\)]/g, '');
      return cleanApplicantPhone === cleanPhone;
    });

    if (duplicate) {
      return {
        isDuplicate: true,
        message: 'Nomor telepon sudah terdaftar',
        existingApplicantId: duplicate.id
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking phone duplicate:', error);
    return { isDuplicate: false };
  }
};

export const checkNISNDuplicate = async (
  nisn: string,
  excludeUserId?: string
): Promise<DuplicateCheckResult> => {
  try {
    const cleanNISN = nisn.replace(/\s/g, '');

    const { data: applicants, error } = await supabase
      .from('applicants')
      .select('id, user_id, dynamic_data')
      .neq('user_id', excludeUserId || 'none');

    if (error) {
      console.error('Error checking NISN duplicate:', error);
      return { isDuplicate: false };
    }

    const duplicate = applicants?.find(applicant => {
      const applicantNISN = getFieldValue(applicant.dynamic_data, FIELD_NAMES.NISN);
      if (!applicantNISN) return false;

      const cleanApplicantNISN = applicantNISN.replace(/\s/g, '');
      return cleanApplicantNISN === cleanNISN;
    });

    if (duplicate) {
      return {
        isDuplicate: true,
        message: 'NISN sudah terdaftar',
        existingApplicantId: duplicate.id
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking NISN duplicate:', error);
    return { isDuplicate: false };
  }
};

export const checkNIKDuplicate = async (
  nik: string,
  excludeUserId?: string
): Promise<DuplicateCheckResult> => {
  try {
    const cleanNIK = nik.replace(/\s/g, '');

    const { data: applicants, error } = await supabase
      .from('applicants')
      .select('id, user_id, dynamic_data')
      .neq('user_id', excludeUserId || 'none');

    if (error) {
      console.error('Error checking NIK duplicate:', error);
      return { isDuplicate: false };
    }

    const duplicate = applicants?.find(applicant => {
      const applicantNIK = getFieldValue(applicant.dynamic_data, FIELD_NAMES.NIK);
      if (!applicantNIK) return false;

      const cleanApplicantNIK = applicantNIK.replace(/\s/g, '');
      return cleanApplicantNIK === cleanNIK;
    });

    if (duplicate) {
      return {
        isDuplicate: true,
        message: 'NIK sudah terdaftar',
        existingApplicantId: duplicate.id
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking NIK duplicate:', error);
    return { isDuplicate: false };
  }
};
