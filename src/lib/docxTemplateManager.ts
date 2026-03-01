import { supabase } from './supabase';

export interface DocxTemplate {
  id: string;
  name: string;
  description: string | null;
  template_format: 'html' | 'docx';
  docx_template_url: string | null;
  docx_variables: string[];
  docx_layout_config: {
    page_size: string;
    margin_top: number;
    margin_bottom: number;
    margin_left: number;
    margin_right: number;
    orientation: 'portrait' | 'landscape';
  };
  access_rule: 'all' | 'status_based' | 'manual';
  required_status: string[];
  is_self_service: boolean;
  generation_limit: number;
  is_active: boolean;
  template_type: string;
  created_at: string;
  updated_at: string;
}

export interface GenerationStatus {
  canGenerate: boolean;
  currentCount: number;
  remainingCount: number;
  limit: number;
  lastGeneratedAt: string | null;
}

export const getAvailableTemplatesForStudent = async (
  userId: string
): Promise<{ templates: DocxTemplate[]; applicantStatus: string; error?: string }> => {
  try {
    const { data: applicant, error: applicantError } = await supabase
      .from('applicants')
      .select('id, status')
      .eq('user_id', userId)
      .maybeSingle();

    if (applicantError) {
      return { templates: [], applicantStatus: 'draft', error: applicantError.message };
    }

    if (!applicant) {
      return { templates: [], applicantStatus: 'draft', error: 'Applicant not found' };
    }

    const { data: templates, error: templatesError } = await supabase
      .from('letter_templates')
      .select('*')
      .eq('template_format', 'docx')
      .eq('is_self_service', true)
      .eq('is_active', true)
      .order('name');

    if (templatesError) {
      return { templates: [], applicantStatus: applicant.status, error: templatesError.message };
    }

    const availableTemplates = (templates || []).filter(template => {
      if (template.access_rule === 'all') {
        return true;
      }

      if (template.access_rule === 'status_based') {
        return template.required_status.includes(applicant.status);
      }

      return false;
    });

    return {
      templates: availableTemplates,
      applicantStatus: applicant.status
    };
  } catch (error) {
    console.error('Error fetching available templates:', error);
    return {
      templates: [],
      applicantStatus: 'draft',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const checkGenerationLimit = async (
  applicantId: string,
  templateId: string
): Promise<GenerationStatus> => {
  try {
    const { data: template, error: templateError } = await supabase
      .from('letter_templates')
      .select('generation_limit')
      .eq('id', templateId)
      .maybeSingle();

    if (templateError || !template) {
      throw new Error('Template not found');
    }

    const { data: generation, error: generationError } = await supabase
      .from('document_generations')
      .select('generation_count, last_generated_at')
      .eq('applicant_id', applicantId)
      .eq('template_id', templateId)
      .maybeSingle();

    const currentCount = generation?.generation_count || 0;
    const limit = template.generation_limit;

    return {
      canGenerate: currentCount < limit,
      currentCount,
      remainingCount: Math.max(0, limit - currentCount),
      limit,
      lastGeneratedAt: generation?.last_generated_at || null
    };
  } catch (error) {
    console.error('Error checking generation limit:', error);
    return {
      canGenerate: false,
      currentCount: 0,
      remainingCount: 0,
      limit: 3,
      lastGeneratedAt: null
    };
  }
};

export const incrementGenerationCount = async (
  applicantId: string,
  templateId: string,
  fileUrl?: string,
  fileSize?: number
): Promise<{ success: boolean; newCount: number; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('increment_generation_count', {
      p_applicant_id: applicantId,
      p_template_id: templateId,
      p_file_url: fileUrl || null,
      p_file_size: fileSize || null
    });

    if (error) {
      console.error('Error incrementing generation count:', error);
      return { success: false, newCount: 0, error: error.message };
    }

    return { success: true, newCount: data };
  } catch (error) {
    console.error('Error incrementing generation count:', error);
    return {
      success: false,
      newCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const getApplicantData = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('applicants')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching applicant data:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching applicant data:', error);
    return null;
  }
};

export const uploadDocxTemplate = async (
  file: File,
  templateId: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    const fileName = `${templateId}_${Date.now()}.docx`;

    const { error: uploadError } = await supabase.storage
      .from('docx-templates')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    return { success: true, url: fileName };
  } catch (error) {
    console.error('Error uploading template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const uploadLetterheadImage = async (
  file: File,
  imageType: 'logo' | 'stamp' | 'foundation' | 'letterhead' = 'letterhead'
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    const fileName = `${imageType}_${Date.now()}.${file.name.split('.').pop()}`;

    const { error: uploadError } = await supabase.storage
      .from('letterhead-images')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    return { success: true, url: fileName };
  } catch (error) {
    console.error('Error uploading image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
