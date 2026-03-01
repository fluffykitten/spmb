import React, { useState } from 'react';
import { FileText, Download, Clock } from 'lucide-react';
import { DocumentWithDownloadInfo, trackDocumentDownload } from '../../lib/documentAccess';
import { getAccessRuleLabel } from '../../lib/letterAccess';

interface DocumentCardProps {
  document: DocumentWithDownloadInfo;
  applicantId: string;
  onDownloadComplete?: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  applicantId,
  onDownloadComplete
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      await trackDocumentDownload(document.id, applicantId);

      const link = window.document.createElement('a');
      link.href = document.file_url;
      link.download = `${document.name}.pdf`;
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);

      if (onDownloadComplete) {
        onDownloadComplete();
      }
    } catch (error) {
      console.error('Error downloading document:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const hasBeenDownloaded = document.download_info && document.download_info.download_count > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
            <FileText className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {document.name}
          </h3>

          {document.description && (
            <p className="text-sm text-gray-600 mb-3">
              {document.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-4">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDate(document.created_at)}
            </span>

            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
              {getAccessRuleLabel(document.access_rule)}
            </span>

            {hasBeenDownloaded && (
              <span className="text-xs text-green-600">
                Diunduh {document.download_info!.download_count}x
                {document.download_info!.downloaded_at &&
                  ` (terakhir: ${formatDate(document.download_info!.downloaded_at)})`
                }
              </span>
            )}
          </div>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? 'Mengunduh...' : hasBeenDownloaded ? 'Unduh Lagi' : 'Unduh Dokumen'}
          </button>
        </div>
      </div>
    </div>
  );
};
