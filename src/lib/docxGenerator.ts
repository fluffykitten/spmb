import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import ImageModule from 'docxtemplater-image-module-free';
import { supabase } from './supabase';
import { MappedVariables } from './variableMapping';
import { enforceDocxLayout } from './docxLayoutEnforcer';
import { DocxLayoutConfig } from './layoutConstants';

interface LetterheadConfig {
  letterhead_image_url?: string;
  school_logo_url?: string;
  foundation_logo_url?: string;
  stamp_image_url?: string;
  school_name?: string;
  school_address?: string;
  school_phone?: string;
  school_email?: string;
  letterhead_style?: {
    logo_size?: number;
    logo_position?: string;
  };
}

interface DocxGenerationOptions {
  templateUrl: string;
  variables: MappedVariables;
  letterheadConfig?: LetterheadConfig;
  layoutConfig?: DocxLayoutConfig;
  fileName: string;
}

export const loadDocxTemplate = async (templateUrl: string): Promise<ArrayBuffer> => {
  const { data, error } = await supabase.storage
    .from('docx-templates')
    .download(templateUrl);

  if (error) {
    throw new Error(`Failed to load template: ${error.message}`);
  }

  if (!data) {
    throw new Error('Template file not found');
  }

  return await data.arrayBuffer();
};

export const loadImageAsBase64 = async (
  bucket: string,
  path: string
): Promise<string | null> => {
  if (!path) return null;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error || !data) {
      console.error(`Failed to load image from ${bucket}/${path}:`, error);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    const mimeType = data.type || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error loading image:`, error);
    return null;
  }
};

const getImageSize = (base64Image: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = base64Image;
  });
};

const imageOptions = {
  centered: false,
  getImage: (tagValue: string) => {
    if (!tagValue || !tagValue.startsWith('data:')) {
      return null;
    }

    const base64Data = tagValue.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  },
  getSize: async (img: Uint8Array, tagValue: string) => {
    try {
      const size = await getImageSize(tagValue);

      const maxWidth = 150;
      const maxHeight = 150;

      let width = size.width;
      let height = size.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      return [width, height];
    } catch (error) {
      console.error('Error getting image size:', error);
      return [100, 100];
    }
  }
};

export const generateDocxFromTemplate = async (
  options: DocxGenerationOptions
): Promise<Blob> => {
  const { templateUrl, variables, letterheadConfig, layoutConfig, fileName } = options;

  const templateBuffer = await loadDocxTemplate(templateUrl);
  const zip = new PizZip(templateBuffer);

  const imageModule = new ImageModule(imageOptions);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
    nullGetter: () => ''
  });

  const dataForTemplate: Record<string, any> = { ...variables };

  if (letterheadConfig) {
    if (letterheadConfig.school_logo_url) {
      const logoBase64 = await loadImageAsBase64(
        'letterhead-images',
        letterheadConfig.school_logo_url
      );
      if (logoBase64) {
        dataForTemplate.logo_sekolah = logoBase64;
        dataForTemplate.school_logo = logoBase64;
      }
    }

    if (letterheadConfig.foundation_logo_url) {
      const foundationLogoBase64 = await loadImageAsBase64(
        'letterhead-images',
        letterheadConfig.foundation_logo_url
      );
      if (foundationLogoBase64) {
        dataForTemplate.logo_yayasan = foundationLogoBase64;
        dataForTemplate.foundation_logo = foundationLogoBase64;
      }
    }

    if (letterheadConfig.stamp_image_url) {
      const stampBase64 = await loadImageAsBase64(
        'letterhead-images',
        letterheadConfig.stamp_image_url
      );
      if (stampBase64) {
        dataForTemplate.stempel = stampBase64;
        dataForTemplate.stamp = stampBase64;
      }
    }

    if (letterheadConfig.school_name) {
      dataForTemplate.nama_sekolah = letterheadConfig.school_name;
      dataForTemplate.school_name = letterheadConfig.school_name;
    }

    if (letterheadConfig.school_address) {
      dataForTemplate.alamat_sekolah = letterheadConfig.school_address;
      dataForTemplate.school_address = letterheadConfig.school_address;
    }

    if (letterheadConfig.school_phone) {
      dataForTemplate.telepon_sekolah = letterheadConfig.school_phone;
      dataForTemplate.school_phone = letterheadConfig.school_phone;
    }

    if (letterheadConfig.school_email) {
      dataForTemplate.email_sekolah = letterheadConfig.school_email;
      dataForTemplate.school_email = letterheadConfig.school_email;
    }
  }

  doc.render(dataForTemplate);

  let outputZip = doc.getZip();

  if (layoutConfig) {
    console.log('Applying layout config...');
    try {
      let letterheadBase64: string | undefined;

      if (letterheadConfig?.letterhead_image_url) {
        console.log('Loading letterhead image from:', letterheadConfig.letterhead_image_url);
        const loaded = await loadImageAsBase64(
          'letterhead-images',
          letterheadConfig.letterhead_image_url
        );
        if (loaded) {
          console.log('Letterhead image loaded successfully');
          letterheadBase64 = loaded;
        } else {
          console.warn('Failed to load letterhead image');
        }
      } else {
        console.log('No letterhead_image_url provided');
      }

      outputZip = await enforceDocxLayout(outputZip, layoutConfig, letterheadBase64);
      console.log('Layout config applied successfully');
    } catch (layoutError) {
      console.error('Failed to apply layout settings:', layoutError);
    }
  } else {
    console.log('No layout config provided');
  }

  const blob = outputZip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 9
    }
  });

  return blob;
};

export const downloadDocx = (blob: Blob, fileName: string): void => {
  const sanitizedFileName = fileName
    .replace(/[^a-z0-9_\-\.]/gi, '_')
    .replace(/_{2,}/g, '_');

  const finalFileName = sanitizedFileName.endsWith('.docx')
    ? sanitizedFileName
    : `${sanitizedFileName}.docx`;

  saveAs(blob, finalFileName);
};

export const generateAndDownloadDocx = async (
  options: DocxGenerationOptions
): Promise<{ success: boolean; error?: string; fileSize?: number }> => {
  try {
    const blob = await generateDocxFromTemplate(options);

    downloadDocx(blob, options.fileName);

    return {
      success: true,
      fileSize: blob.size
    };
  } catch (error) {
    console.error('Error generating DOCX:', error);

    let errorMessage = 'Gagal generate dokumen. Silakan coba lagi.';

    if (error instanceof Error) {
      if (error.message.includes('Failed to load template')) {
        errorMessage = 'Template tidak ditemukan atau rusak.';
      } else if (error.message.includes('render')) {
        errorMessage = 'Terjadi kesalahan saat mengisi data ke template. Pastikan semua variabel tersedia.';
      } else if (error.message.includes('image')) {
        errorMessage = 'Gagal memuat gambar kop surat.';
      }
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

export const getLetterheadConfig = async (): Promise<LetterheadConfig | null> => {
  try {
    const { data, error } = await supabase
      .from('letterhead_config')
      .select('*')
      .eq('is_active', true)
      .eq('config_key', 'global')
      .maybeSingle();

    if (error) {
      console.error('Error fetching letterhead config:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching letterhead config:', error);
    return null;
  }
};
