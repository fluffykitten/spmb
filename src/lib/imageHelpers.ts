import { supabase } from './supabase';

export const isImagePath = (value: any): boolean => {
  if (typeof value !== 'string') return false;

  return value.includes('applicant-images') ||
         value.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) !== null;
};

export const extractImagePath = (urlOrPath: string): string => {
  if (!urlOrPath) return '';

  if (urlOrPath.includes('applicant-images/')) {
    const match = urlOrPath.match(/applicant-images\/(.+)$/);
    return match ? match[1] : urlOrPath;
  }

  return urlOrPath;
};

export const getSignedImageUrl = async (pathOrUrl: string): Promise<string | null> => {
  try {
    if (!pathOrUrl) return null;

    let filePath = extractImagePath(pathOrUrl);

    if (!filePath.startsWith('applicant-images/')) {
      filePath = `applicant-images/${filePath}`;
    }

    const actualPath = filePath.replace('applicant-images/', '');

    const { data, error } = await supabase.storage
      .from('applicant-images')
      .createSignedUrl(actualPath, 31536000);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error('Error in getSignedImageUrl:', error);
    return null;
  }
};

export const getSignedImageUrls = async (paths: string[]): Promise<Record<string, string>> => {
  const results: Record<string, string> = {};

  await Promise.all(
    paths.map(async (path) => {
      if (path) {
        const signedUrl = await getSignedImageUrl(path);
        if (signedUrl) {
          results[path] = signedUrl;
        }
      }
    })
  );

  return results;
};
