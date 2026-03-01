import { supabase } from './supabase';

const MAX_FILE_SIZE = 1 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadExamImage(file: File, examId?: string): Promise<UploadResult> {
  console.log('[examImageUpload] Starting upload:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    examId
  });

  if (!ALLOWED_TYPES.includes(file.type)) {
    console.error('[examImageUpload] Invalid file type:', file.type);
    return {
      success: false,
      error: 'Tipe file tidak didukung. Gunakan PNG, JPG, GIF, atau WebP.'
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    console.error('[examImageUpload] File too large:', file.size);
    return {
      success: false,
      error: 'Ukuran file terlalu besar. Maksimal 1 MB.'
    };
  }

  try {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = examId || 'general';
    const filePath = `${folder}/${timestamp}-${sanitizedName}`;

    console.log('[examImageUpload] Uploading to path:', filePath);

    const { data, error } = await supabase.storage
      .from('exam-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[examImageUpload] Upload error:', error);
      return {
        success: false,
        error: `Gagal mengunggah gambar: ${error.message}`
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from('exam-images')
      .getPublicUrl(data.path);

    console.log('[examImageUpload] Upload successful:', publicUrlData.publicUrl);

    return {
      success: true,
      url: publicUrlData.publicUrl
    };
  } catch (error) {
    console.error('[examImageUpload] Unexpected error:', error);
    return {
      success: false,
      error: 'Terjadi kesalahan saat mengunggah gambar.'
    };
  }
}

export async function deleteExamImage(imageUrl: string): Promise<boolean> {
  console.log('[examImageUpload] Deleting image:', imageUrl);

  try {
    const urlObj = new URL(imageUrl);
    const pathParts = urlObj.pathname.split('/exam-images/');

    if (pathParts.length < 2) {
      console.error('[examImageUpload] Could not extract path from URL');
      return false;
    }

    const filePath = decodeURIComponent(pathParts[1]);
    console.log('[examImageUpload] Extracted file path:', filePath);

    const { error } = await supabase.storage
      .from('exam-images')
      .remove([filePath]);

    if (error) {
      console.error('[examImageUpload] Delete error:', error);
      return false;
    }

    console.log('[examImageUpload] Delete successful');
    return true;
  } catch (error) {
    console.error('[examImageUpload] Unexpected error during delete:', error);
    return false;
  }
}
