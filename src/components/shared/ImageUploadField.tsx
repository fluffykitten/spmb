import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FormField } from '../../lib/defaultFormSchema';
import { getSignedImageUrl } from '../../lib/imageHelpers';

interface ImageUploadFieldProps {
  field: FormField;
  value: string | null;
  onChange: (url: string | null) => void;
  userId: string;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  field,
  value,
  onChange,
  userId
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value);

  const maxSizeMB = field.imageConfig?.maxSizeMB || 5;
  const acceptedFormats = field.imageConfig?.acceptedFormats || ['image/jpeg', 'image/png'];
  const maxWidth = field.imageConfig?.maxWidth;
  const maxHeight = field.imageConfig?.maxHeight;

  const validateImage = async (file: File): Promise<boolean> => {
    if (!acceptedFormats.includes(file.type)) {
      setError(`Format tidak didukung. Gunakan ${acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`);
      return false;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB`);
      return false;
    }

    if (maxWidth || maxHeight) {
      return new Promise((resolve) => {
        const img = document.createElement('img');
        img.onload = () => {
          if (maxWidth && img.width > maxWidth) {
            setError(`Lebar gambar terlalu besar. Maksimal ${maxWidth}px`);
            resolve(false);
            return;
          }
          if (maxHeight && img.height > maxHeight) {
            setError(`Tinggi gambar terlalu besar. Maksimal ${maxHeight}px`);
            resolve(false);
            return;
          }
          resolve(true);
        };
        img.src = URL.createObjectURL(file);
      });
    }

    return true;
  };

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);

      const isValid = await validateImage(file);
      if (!isValid) {
        setUploading(false);
        return;
      }

      setUploadProgress(25);

      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${field.name}_${timestamp}.${fileExt}`;

      setUploadProgress(50);

      const { error: uploadError } = await supabase.storage
        .from('applicant-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      setUploadProgress(75);

      const signedUrl = await getSignedImageUrl(fileName);
      if (!signedUrl) {
        throw new Error('Gagal membuat signed URL');
      }

      setUploadProgress(100);
      setPreview(signedUrl);
      onChange(fileName);
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Gagal mengupload gambar');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    if (!value) return;

    try {
      const fileName = value.includes('applicant-images/')
        ? value.split('applicant-images/')[1]
        : value;

      await supabase.storage
        .from('applicant-images')
        .remove([fileName]);

      setPreview(null);
      onChange(null);
      setError(null);
    } catch (err: any) {
      console.error('Error removing image:', err);
      setError('Gagal menghapus gambar');
    }
  };

  useEffect(() => {
    const loadSignedUrl = async () => {
      if (value && !preview) {
        const signedUrl = await getSignedImageUrl(value);
        if (signedUrl) {
          setPreview(signedUrl);
        }
      }
    };

    loadSignedUrl();
  }, [value]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadImage(acceptedFiles[0]);
    }
  }, [field, userId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats.reduce((acc, format) => {
      acc[format] = [];
      return acc;
    }, {} as Record<string, string[]>),
    multiple: false,
    disabled: uploading
  });

  if (preview) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-lg border-2 border-slate-200 overflow-hidden bg-slate-50">
          <img
            src={preview}
            alt={field.label}
            className="w-full h-64 object-contain"
          />
          {!uploading && (
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4" />
          <span>Gambar berhasil diupload</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 bg-slate-50'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <ImageIcon className="h-12 w-12 text-slate-400 mx-auto mb-3" />
        {uploading ? (
          <>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Mengupload... {uploadProgress}%
            </p>
            <div className="max-w-xs mx-auto bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </>
        ) : isDragActive ? (
          <p className="text-sm font-medium text-blue-700">
            Lepaskan file di sini...
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700 mb-1">
              <Upload className="h-4 w-4 inline mr-1" />
              Klik atau drag & drop untuk upload
            </p>
            <p className="text-xs text-slate-500">
              {acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')} •
              Maksimal {maxSizeMB}MB
              {(maxWidth || maxHeight) && (
                <> • Maks {maxWidth || '∞'}x{maxHeight || '∞'}px</>
              )}
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
