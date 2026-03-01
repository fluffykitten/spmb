import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadLetterheadImage } from '../../lib/docxTemplateManager';
import { Upload, Save, Loader2, CheckCircle, X, Info } from 'lucide-react';

interface LetterheadConfig {
  id?: string;
  letterhead_image_url: string;
}

export const LetterheadManager: React.FC = () => {
  const [config, setConfig] = useState<LetterheadConfig>({
    letterhead_image_url: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('letterhead_config')
        .select('id, letterhead_image_url')
        .eq('config_key', 'global')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: data.id,
          letterhead_image_url: data.letterhead_image_url || ''
        });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setMessage(null);

    try {
      const result = await uploadLetterheadImage(file, 'letterhead');

      if (result.success && result.url) {
        setConfig(prev => ({ ...prev, letterhead_image_url: result.url }));
        setMessage({ type: 'success', text: 'Gambar kop surat berhasil diupload!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Gagal upload gambar' });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat upload' });
    } finally {
      setUploading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleSave = async () => {
    if (!config.letterhead_image_url) {
      setMessage({ type: 'error', text: 'Mohon upload gambar kop surat terlebih dahulu' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('letterhead_config')
        .upsert({
          config_key: 'global',
          letterhead_image_url: config.letterhead_image_url,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'config_key'
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Konfigurasi kop surat berhasil disimpan!' });
      await fetchConfig();
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: 'Gagal menyimpan konfigurasi' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getImageUrl = (path: string) => {
    if (!path) return null;
    const { data } = supabase.storage
      .from('letterhead-images')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Konfigurasi Kop Surat
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Upload gambar kop surat yang sudah jadi. Gambar ini akan otomatis ditambahkan sebagai header di semua dokumen DOCX yang digenerate siswa.
        </p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-2 ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            ) : (
              <X className="h-5 w-5 text-red-600 flex-shrink-0" />
            )}
            <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {message.text}
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-2">Panduan Kop Surat:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Format: PNG atau JPG (maksimal 5MB)</li>
                <li>Resolusi: Minimal 1200px lebar untuk kualitas terbaik</li>
                <li>Gambar harus sudah include nama sekolah, logo, alamat, telepon, email, dll</li>
                <li>Disarankan background transparan (PNG) untuk hasil lebih profesional</li>
                <li>Kop surat akan otomatis ditambahkan di bagian atas setiap halaman dokumen</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
          {config.letterhead_image_url && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">Preview Kop Surat:</p>
              <div className="bg-white border border-gray-200 rounded-lg p-4 inline-block">
                <img
                  src={getImageUrl(config.letterhead_image_url) || ''}
                  alt="Kop Surat"
                  className="max-h-48 mx-auto object-contain"
                />
              </div>
            </div>
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 5 * 1024 * 1024) {
                  setMessage({ type: 'error', text: 'Ukuran file maksimal 5MB' });
                  setTimeout(() => setMessage(null), 3000);
                  return;
                }
                handleImageUpload(file);
              }
            }}
            disabled={uploading}
            className="hidden"
            id="letterhead-upload"
          />

          <label
            htmlFor="letterhead-upload"
            className={`inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors font-medium ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                {config.letterhead_image_url ? 'Ganti Gambar Kop Surat' : 'Upload Gambar Kop Surat'}
              </>
            )}
          </label>

          <p className="text-xs text-gray-500 mt-3">
            PNG atau JPG, maksimal 5MB
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !config.letterhead_image_url}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Simpan Konfigurasi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
