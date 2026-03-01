import React, { useState } from 'react';
import { FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DocumentDownloadStatusProps {
  applicantId: string;
  downloadedCount: number;
  totalCount: number;
}

interface DocumentDetail {
  document_id: string;
  document_name: string;
  document_description: string | null;
  is_downloaded: boolean;
  download_count: number;
  last_downloaded: string | null;
  access_rule: string;
}

export const DocumentDownloadStatus: React.FC<DocumentDownloadStatusProps> = ({
  applicantId,
  downloadedCount,
  totalCount
}) => {
  const [showModal, setShowModal] = useState(false);
  const [documents, setDocuments] = useState<DocumentDetail[]>([]);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setShowModal(true);
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('admin_get_document_download_details', {
        p_applicant_id: applicantId
      });

      if (error) throw error;

      setDocuments(data || []);
    } catch (error) {
      console.error('[DocumentDownloadStatus] Error fetching details:', error);
    } finally {
      setLoading(false);
    }
  };

  const percentage = totalCount > 0 ? Math.round((downloadedCount / totalCount) * 100) : 0;

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors group"
      >
        <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">
          {downloadedCount}/{totalCount}
        </span>
        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              percentage === 100 ? 'bg-emerald-500' : percentage > 0 ? 'bg-amber-500' : 'bg-slate-300'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">Document Download Details</h3>
              <p className="text-sm text-slate-600 mt-1">
                {downloadedCount} of {totalCount} documents downloaded
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-slate-600">Loading...</div>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-500">
                  <FileText className="h-8 w-8 mb-2" />
                  <p>No documents available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.document_id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {doc.is_downloaded ? (
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-medium text-slate-800">{doc.document_name}</h4>
                              {doc.document_description && (
                                <p className="text-sm text-slate-600 mt-0.5">
                                  {doc.document_description}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                doc.is_downloaded
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {doc.is_downloaded ? 'Downloaded' : 'Not Downloaded'}
                            </span>
                          </div>
                          {doc.is_downloaded && (
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {doc.last_downloaded
                                  ? new Date(doc.last_downloaded).toLocaleString('id-ID', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : 'Unknown'}
                              </span>
                              <span>Downloads: {doc.download_count}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
