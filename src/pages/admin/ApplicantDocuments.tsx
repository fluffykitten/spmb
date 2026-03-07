import React, { useState, useEffect } from 'react';
import { FileText, Edit2, Trash2, Search, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';
import { DocumentUploader } from '../../components/admin/DocumentUploader';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import {
  getAllDocuments,
  deleteApplicantDocument,
  updateDocumentMetadata,
  getAllDocumentStats,
  ApplicantDocument
} from '../../lib/documentAccess';
import { getAccessRuleLabel, AccessRule } from '../../lib/letterAccess';

export const ApplicantDocuments: React.FC = () => {
  const [documents, setDocuments] = useState<ApplicantDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<ApplicantDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccessRule, setFilterAccessRule] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingDoc, setEditingDoc] = useState<ApplicantDocument | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; documentId: string | null }>({
    isOpen: false,
    documentId: null
  });
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalDownloads: 0,
    mostDownloadedDocument: null as { name: string; downloads: number } | null
  });

  useEffect(() => {
    fetchDocuments();
    fetchStats();
  }, []);

  useEffect(() => {
    filterDocumentsList();
  }, [documents, searchQuery, filterAccessRule, filterStatus]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data } = await getAllDocuments();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const { data } = await getAllDocumentStats();
    setStats(data);
  };

  const filterDocumentsList = () => {
    let filtered = [...documents];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.name.toLowerCase().includes(query) ||
        doc.description?.toLowerCase().includes(query)
      );
    }

    if (filterAccessRule !== 'all') {
      filtered = filtered.filter(doc => doc.access_rule === filterAccessRule);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(doc =>
        filterStatus === 'active' ? doc.is_active : !doc.is_active
      );
    }

    setFilteredDocuments(filtered);
  };

  const handleDelete = async (documentId: string) => {
    try {
      const { error } = await deleteApplicantDocument(documentId);
      if (error) throw error;
      await fetchDocuments();
      await fetchStats();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleUpdateOrder = async (documentId: string, newOrder: number) => {
    try {
      const { error } = await updateDocumentMetadata(documentId, {
        display_order: newOrder
      });
      if (error) throw error;
      await fetchDocuments();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const handleToggleStatus = async (doc: ApplicantDocument) => {
    try {
      const { error } = await updateDocumentMetadata(doc.id, {
        is_active: !doc.is_active
      });
      if (error) throw error;
      await fetchDocuments();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingDoc) return;

    try {
      const { error } = await updateDocumentMetadata(editingDoc.id, {
        name: editingDoc.name,
        description: editingDoc.description || undefined,
        access_rule: editingDoc.access_rule,
        display_order: editingDoc.display_order
      });
      if (error) throw error;
      setEditingDoc(null);
      await fetchDocuments();
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dokumen Siswa</h1>
        <p className="text-gray-600 mt-2">
          Upload dan kelola dokumen yang dapat diakses oleh siswa
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Dokumen</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Unduhan</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDownloads}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Paling Populer</p>
              {stats.mostDownloadedDocument ? (
                <>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {stats.mostDownloadedDocument.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.mostDownloadedDocument.downloads} unduhan
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Belum ada data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Dokumen Baru</h2>
        </div>
        <div className="p-6">
          <DocumentUploader
            onUploadComplete={() => {
              fetchDocuments();
              fetchStats();
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Daftar Dokumen ({filteredDocuments.length})
            </h2>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari dokumen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                />
              </div>

              <select
                value={filterAccessRule}
                onChange={(e) => setFilterAccessRule(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Aturan</option>
                <option value="always">Tersedia Segera</option>
                <option value="after_submission">Setelah Submit</option>
                <option value="after_approval">Setelah Disetujui</option>
                <option value="after_rejection">Setelah Ditolak</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 mt-4">Memuat dokumen...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchQuery || filterAccessRule !== 'all' || filterStatus !== 'all'
                  ? 'Tidak ada dokumen yang sesuai dengan filter'
                  : 'Belum ada dokumen. Upload dokumen pertama Anda di atas.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  {editingDoc?.id === doc.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nama Dokumen
                        </label>
                        <input
                          type="text"
                          value={editingDoc.name}
                          onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Deskripsi
                        </label>
                        <textarea
                          value={editingDoc.description || ''}
                          onChange={(e) => setEditingDoc({ ...editingDoc, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Aturan Akses
                          </label>
                          <select
                            value={editingDoc.access_rule}
                            onChange={(e) => setEditingDoc({ ...editingDoc, access_rule: e.target.value as AccessRule })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="always">Tersedia Segera</option>
                            <option value="after_submission">Setelah Submit Pendaftaran</option>
                            <option value="after_approval">Setelah Disetujui</option>
                            <option value="after_rejection">Setelah Ditolak</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Urutan Tampilan
                          </label>
                          <input
                            type="number"
                            value={editingDoc.display_order}
                            onChange={(e) => setEditingDoc({ ...editingDoc, display_order: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min={0}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => setEditingDoc(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{doc.name}</h3>
                            {doc.description && (
                              <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleUpdateOrder(doc.id, doc.display_order - 1)}
                              className="p-1 text-gray-400 hover:text-blue-600"
                              title="Pindah ke atas"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleUpdateOrder(doc.id, doc.display_order + 1)}
                              className="p-1 text-gray-400 hover:text-blue-600"
                              title="Pindah ke bawah"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            {getAccessRuleLabel(doc.access_rule)}
                          </span>
                          <StatusBadge status={doc.is_active ? 'approved' : 'draft'} />
                          <span className="text-gray-500">Urutan: {doc.display_order}</span>
                          <span className="text-gray-500">Upload: {formatDate(doc.created_at)}</span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingDoc(doc)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(doc)}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                          >
                            {doc.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            onClick={() => setDeleteDialog({ isOpen: true, documentId: doc.id })}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                          >
                            <Trash2 className="w-4 h-4" />
                            Hapus
                          </button>
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                          >
                            Preview
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Hapus Dokumen"
        message="Apakah Anda yakin ingin menghapus dokumen ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        onConfirm={() => {
          if (deleteDialog.documentId) {
            handleDelete(deleteDialog.documentId);
          }
          setDeleteDialog({ isOpen: false, documentId: null });
        }}
        onClose={() => setDeleteDialog({ isOpen: false, documentId: null })}
      />
    </div>
  );
};
