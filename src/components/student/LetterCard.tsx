import { Download, FileText, Calendar, Eye } from 'lucide-react';
import { GeneratedLetter, trackLetterDownload, getAccessRuleLabel } from '../../lib/letterAccess';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface LetterCardProps {
  letter: GeneratedLetter;
  onDownload?: () => void;
}

export default function LetterCard({ letter, onDownload }: LetterCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const getFileUrl = () => {
    const { data } = supabase.storage
      .from('generated-letters')
      .getPublicUrl(letter.pdf_url);
    return data.publicUrl;
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await trackLetterDownload(letter.id);

      const fileUrl = getFileUrl();
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${letter.template.name}_${letter.letter_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (onDownload) {
        onDownload();
      }
    } catch (error) {
      console.error('Error downloading letter:', error);
      alert('Gagal mengunduh surat. Silakan coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = () => {
    setPreviewing(true);
    const fileUrl = getFileUrl();
    window.open(fileUrl, '_blank');
    setTimeout(() => setPreviewing(false), 1000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const isNew = !letter.downloaded_at;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{letter.template.name}</h3>
              {isNew && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                  Baru
                </span>
              )}
            </div>
            {letter.template.description && (
              <p className="text-sm text-gray-600 mt-1">{letter.template.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Dibuat: {formatDate(letter.generated_at)}
              </span>
              {letter.downloaded_at && (
                <span>
                  Diunduh: {letter.download_count}x
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-500 flex-1">
          {getAccessRuleLabel(letter.template.access_rule)}
        </span>
        <button
          onClick={handlePreview}
          disabled={previewing}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Mengunduh...' : 'Unduh'}
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded p-2">
        <span className="font-medium">Nomor Surat:</span> {letter.letter_number}
      </div>
    </div>
  );
}
