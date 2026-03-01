import { supabase } from './supabase';
import { AccessRule, canAccessLetter } from './letterAccess';

export interface ApplicantDocument {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_url: string;
  access_rule: AccessRule;
  display_order: number;
  is_active: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentDownload {
  id: string;
  document_id: string;
  applicant_id: string;
  downloaded_at: string;
  download_count: number;
}

export interface DocumentWithDownloadInfo extends ApplicantDocument {
  download_info?: DocumentDownload;
}

export async function uploadApplicantDocument(
  file: File,
  metadata: {
    name: string;
    description?: string;
    access_rule: AccessRule;
    display_order?: number;
    is_active?: boolean;
  }
) {
  try {
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `documents/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('applicant-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('applicant-documents')
      .getPublicUrl(filePath);

    const { data: { user } } = await supabase.auth.getUser();

    const { data: document, error: dbError } = await supabase
      .from('applicant_documents')
      .insert({
        name: metadata.name,
        description: metadata.description || null,
        file_path: filePath,
        file_url: urlData.publicUrl,
        access_rule: metadata.access_rule,
        display_order: metadata.display_order ?? 0,
        is_active: metadata.is_active ?? true,
        uploaded_by: user?.id
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from('applicant-documents').remove([filePath]);
      throw dbError;
    }

    return { data: document, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function getGlobalDocumentsForStudent(userId: string) {
  try {
    const { data: applicant, error: applicantError } = await supabase
      .from('applicants')
      .select('id, status')
      .eq('user_id', userId)
      .maybeSingle();

    if (applicantError) throw applicantError;
    if (!applicant) {
      return { data: [], error: null, applicantStatus: 'draft' as const };
    }

    const { data: documents, error: docsError } = await supabase
      .from('applicant_documents')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (docsError) throw docsError;

    const accessibleDocs = (documents || []).filter((doc) =>
      canAccessLetter(doc.access_rule, applicant.status)
    );

    const { data: downloadRecords, error: downloadError } = await supabase
      .from('document_downloads')
      .select('*')
      .eq('applicant_id', applicant.id)
      .in('document_id', accessibleDocs.map(d => d.id));

    if (downloadError) throw downloadError;

    const downloadMap = new Map(
      (downloadRecords || []).map(record => [record.document_id, record])
    );

    const docsWithDownloadInfo: DocumentWithDownloadInfo[] = accessibleDocs.map(doc => ({
      ...doc,
      download_info: downloadMap.get(doc.id)
    }));

    return {
      data: docsWithDownloadInfo,
      error: null,
      applicantStatus: applicant.status
    };
  } catch (error) {
    return { data: [], error, applicantStatus: 'draft' as const };
  }
}

export async function trackDocumentDownload(documentId: string, applicantId: string) {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('document_downloads')
      .select('*')
      .eq('document_id', documentId)
      .eq('applicant_id', applicantId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      const { error: updateError } = await supabase
        .from('document_downloads')
        .update({
          download_count: existing.download_count + 1,
          downloaded_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('document_downloads')
        .insert({
          document_id: documentId,
          applicant_id: applicantId,
          download_count: 1
        });

      if (insertError) throw insertError;
    }

    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function deleteApplicantDocument(documentId: string) {
  try {
    const { data: document, error: fetchError } = await supabase
      .from('applicant_documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;

    const { error: deleteError } = await supabase
      .from('applicant_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) throw deleteError;

    await supabase.storage
      .from('applicant-documents')
      .remove([document.file_path]);

    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function updateDocumentMetadata(
  documentId: string,
  updates: {
    name?: string;
    description?: string;
    access_rule?: AccessRule;
    display_order?: number;
    is_active?: boolean;
  }
) {
  try {
    const { data, error } = await supabase
      .from('applicant_documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function getAllDocuments() {
  try {
    const { data, error } = await supabase
      .from('applicant_documents')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function getDocumentDownloadStats(documentId: string) {
  try {
    const { data, error } = await supabase
      .from('document_downloads')
      .select('*')
      .eq('document_id', documentId);

    if (error) throw error;

    const totalDownloads = (data || []).reduce((sum, record) => sum + record.download_count, 0);
    const uniqueStudents = new Set(data?.map(record => record.applicant_id)).size;

    return {
      data: {
        totalDownloads,
        uniqueStudents,
        records: data || []
      },
      error: null
    };
  } catch (error) {
    return {
      data: { totalDownloads: 0, uniqueStudents: 0, records: [] },
      error
    };
  }
}

export async function getAllDocumentStats() {
  try {
    const { data: documents, error: docsError } = await supabase
      .from('applicant_documents')
      .select('id, name');

    if (docsError) throw docsError;

    const { data: downloads, error: downloadError } = await supabase
      .from('document_downloads')
      .select('*');

    if (downloadError) throw downloadError;

    const totalDocuments = documents?.length || 0;
    const totalDownloads = (downloads || []).reduce((sum, record) => sum + record.download_count, 0);

    const downloadsByDoc = new Map<string, number>();
    (downloads || []).forEach(record => {
      const current = downloadsByDoc.get(record.document_id) || 0;
      downloadsByDoc.set(record.document_id, current + record.download_count);
    });

    let mostDownloadedDoc = null;
    let maxDownloads = 0;
    downloadsByDoc.forEach((count, docId) => {
      if (count > maxDownloads) {
        maxDownloads = count;
        mostDownloadedDoc = documents?.find(d => d.id === docId);
      }
    });

    return {
      data: {
        totalDocuments,
        totalDownloads,
        mostDownloadedDocument: mostDownloadedDoc ? {
          name: mostDownloadedDoc.name,
          downloads: maxDownloads
        } : null
      },
      error: null
    };
  } catch (error) {
    return {
      data: {
        totalDocuments: 0,
        totalDownloads: 0,
        mostDownloadedDocument: null
      },
      error
    };
  }
}
