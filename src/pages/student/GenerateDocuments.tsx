import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, FileText, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAvailableTemplatesForStudent, DocxTemplate } from '../../lib/docxTemplateManager';
import { DocxTemplateCard } from '../../components/student/DocxTemplateCard';
import { supabase } from '../../lib/supabase';

export default function GenerateDocuments() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<DocxTemplate[]>([]);
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [applicantStatus, setApplicantStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getAvailableTemplatesForStudent(user.id);

      if (result.error) {
        setError(result.error);
      } else {
        setTemplates(result.templates);
        setApplicantStatus(result.applicantStatus);
      }

      const { data: applicant } = await supabase
        .from('applicants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (applicant) {
        setApplicantId(applicant.id);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Terjadi kesalahan saat memuat template');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    const statusConfig: Record<string, { text: string; className: string }> = {
      draft: {
        text: 'Draft',
        className: 'bg-gray-100 text-gray-700'
      },
      submitted: {
        text: 'Terkirim',
        className: 'bg-blue-100 text-blue-700'
      },
      approved: {
        text: 'Disetujui',
        className: 'bg-green-100 text-green-700'
      },
      rejected: {
        text: 'Ditolak',
        className: 'bg-red-100 text-red-700'
      }
    };

    const config = statusConfig[applicantStatus] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Memuat template...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Terjadi Kesalahan</h3>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchTemplates}
                className="mt-3 text-sm font-medium text-red-700 hover:text-red-800 underline"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Generate Dokumen</h1>
              <p className="text-gray-600">
                Generate dan unduh dokumen Anda secara mandiri
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge()}
              <button
                onClick={fetchTemplates}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Belum Ada Template Tersedia
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                {applicantStatus === 'draft' && (
                  'Kirimkan formulir pendaftaran Anda untuk mendapatkan akses ke template dokumen.'
                )}
                {applicantStatus === 'submitted' && (
                  'Template akan tersedia setelah admin memproses pendaftaran Anda.'
                )}
                {applicantStatus === 'approved' && (
                  'Belum ada template yang tersedia untuk status Anda. Silakan hubungi admin untuk informasi lebih lanjut.'
                )}
                {applicantStatus === 'rejected' && (
                  'Tidak ada template yang tersedia untuk status pendaftaran yang ditolak.'
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Template Tersedia</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Pilih template yang ingin Anda generate
                </p>
              </div>
              <span className="text-sm font-medium text-gray-600">
                {templates.length} template
              </span>
            </div>

            <div className="space-y-4">
              {applicantId && templates.map((template) => (
                <DocxTemplateCard
                  key={template.id}
                  template={template}
                  applicantId={applicantId}
                  onGenerateComplete={fetchTemplates}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Informasi Penting:</p>
              <ul className="space-y-1 list-disc list-inside text-blue-800">
                <li>Setiap template memiliki limit generate (biasanya 3x)</li>
                <li>Dokumen akan otomatis terisi dengan data profil Anda</li>
                <li>Pastikan data Anda sudah lengkap sebelum generate</li>
                <li>File akan diunduh dalam format .pdf</li>
                <li>Hubungi admin jika ada pertanyaan atau masalah</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900">
              <p className="font-medium mb-1">Perhatian:</p>
              <p className="text-yellow-800">
                Gunakan kesempatan generate dengan bijak. Setelah mencapai limit, Anda tidak dapat men-generate ulang template yang sama. Pastikan data Anda sudah benar sebelum generate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
