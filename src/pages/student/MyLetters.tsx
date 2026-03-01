import { FileText, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useStudentLetters } from '../../hooks/useStudentLetters';
import LetterCard from '../../components/student/LetterCard';
import { DocumentCard } from '../../components/student/DocumentCard';

export default function MyLetters() {
  const { letters, documents, applicantId, applicantStatus, loading, error, refetch } = useStudentLetters();

  const getStatusBadge = () => {
    const statusConfig = {
      draft: {
        icon: Clock,
        text: 'Draft',
        className: 'bg-gray-100 text-gray-700'
      },
      submitted: {
        icon: CheckCircle,
        text: 'Terkirim',
        className: 'bg-blue-100 text-blue-700'
      },
      approved: {
        icon: CheckCircle,
        text: 'Disetujui',
        className: 'bg-green-100 text-green-700'
      },
      rejected: {
        icon: XCircle,
        text: 'Ditolak',
        className: 'bg-red-100 text-red-700'
      }
    };

    const config = statusConfig[applicantStatus];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        <Icon className="w-4 h-4" />
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Memuat surat...</p>
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
                onClick={refetch}
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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Surat Saya</h1>
              <p className="text-gray-600">
                Kelola dan unduh surat-surat yang tersedia untuk Anda
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge()}
              <button
                onClick={refetch}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {documents.length === 0 && letters.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Belum Ada Dokumen Tersedia
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                {applicantStatus === 'draft' && (
                  'Kirimkan formulir pendaftaran Anda untuk mendapatkan akses ke dokumen-dokumen yang tersedia.'
                )}
                {applicantStatus === 'submitted' && (
                  'Dokumen akan tersedia setelah admin memproses pendaftaran Anda.'
                )}
                {applicantStatus === 'approved' && (
                  'Admin belum menambahkan dokumen. Silakan hubungi admin untuk informasi lebih lanjut.'
                )}
                {applicantStatus === 'rejected' && (
                  'Tidak ada dokumen yang tersedia untuk pendaftaran yang ditolak.'
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {documents.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Dokumen Wajib</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Unduh dokumen yang dibutuhkan untuk proses pendaftaran Anda
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {documents.length} dokumen
                  </span>
                </div>

                <div className="space-y-4">
                  {documents.map((document) => (
                    <DocumentCard
                      key={document.id}
                      document={document}
                      applicantId={applicantId || ''}
                      onDownloadComplete={refetch}
                    />
                  ))}
                </div>
              </div>
            )}

            {letters.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Surat Pribadi</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Surat yang dibuat khusus untuk Anda
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {letters.length} surat
                  </span>
                </div>

                <div className="space-y-4">
                  {letters.map((letter) => (
                    <LetterCard
                      key={letter.id}
                      letter={letter}
                      onDownload={refetch}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Informasi Penting:</p>
              <ul className="space-y-1 list-disc list-inside text-blue-800">
                <li>Dokumen dan surat dapat diunduh berkali-kali sesuai kebutuhan</li>
                <li>Pastikan informasi sudah benar sebelum menggunakan</li>
                <li>Hubungi admin jika ada pertanyaan atau masalah dengan dokumen</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
