import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DataTable, Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { LetterGenerationModal } from '../../components/admin/LetterGenerationModal';
import { Eye, Trash2, Filter, Download, Mail, FileSpreadsheet, CheckCircle, FileText, Search, X, ChevronDown, MessageSquare, Save } from 'lucide-react';
import { exportApplicantsToExcel, exportAcceptedApplicantsToExcel } from '../../lib/excelExport';
import { FIELD_NAMES, getFieldValue } from '../../lib/fieldConstants';
import { isImagePath, getSignedImageUrl } from '../../lib/imageHelpers';
import { sendWhatsAppNotification } from '../../lib/whatsappNotification';
import { sendDocumentsAvailableNotification } from '../../lib/examNotifications';

interface Applicant {
  id: string;
  user_id: string;
  status: string;
  dynamic_data: Record<string, any>;
  registration_number: string | null;
  admin_comments: string | null;
  commented_by: string | null;
  commented_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    role: string;
    email: string;
    full_name: string;
  };
  commenter?: {
    full_name: string;
  };
}

interface FilterState {
  searchQuery: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export const StudentManagement: React.FC = () => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; applicantId: string | null }>({
    isOpen: false,
    applicantId: null
  });
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [exportDialog, setExportDialog] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedApplicants, setSelectedApplicants] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    status: 'all',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchApplicants();
  }, []);

  const fetchApplicants = async () => {
    try {
      setLoading(true);

      const { data: applicantsData, error: applicantsError } = await supabase
        .from('applicants')
        .select('*')
        .order('created_at', { ascending: false });

      if (applicantsError) {
        console.error('Error fetching applicants:', applicantsError);
        throw applicantsError;
      }

      if (!applicantsData || applicantsData.length === 0) {
        setApplicants([]);
        return;
      }

      const userIds = applicantsData.map(a => a.user_id);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, role')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      const profilesMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );

      const enrichedApplicants = applicantsData.map(applicant => ({
        ...applicant,
        profiles: profilesMap.get(applicant.user_id) || null
      }));

      console.log('Fetched applicants with profiles:', enrichedApplicants);
      setApplicants(enrichedApplicants as Applicant[]);
    } catch (error) {
      console.error('Error fetching applicants:', error);
      setApplicants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (applicantId: string, newStatus: string) => {
    try {
      const { error, data } = await supabase
        .from('applicants')
        .update({ status: newStatus })
        .eq('id', applicantId)
        .select('*, dynamic_data, registration_number, admin_comments')
        .single();

      if (error) throw error;

      if (data) {
        const phoneNumber = getFieldValue(data.dynamic_data, FIELD_NAMES.NO_TELEPON);
        const namaLengkap = getFieldValue(data.dynamic_data, FIELD_NAMES.NAMA_LENGKAP);

        if (phoneNumber) {
          let templateKey = '';
          const variables: Record<string, any> = {
            nama_lengkap: namaLengkap || 'Calon Siswa',
            registration_number: data.registration_number || 'Belum tersedia'
          };

          if (newStatus === 'approved') {
            templateKey = 'application_approved';
          } else if (newStatus === 'rejected') {
            templateKey = 'application_rejected';
          } else if (newStatus === 'draft') {
            templateKey = 'application_needs_revision';
            variables.admin_comments = data.admin_comments || 'Mohon periksa kembali data Anda.';
          }

          if (templateKey) {
            sendWhatsAppNotification({
              phone: phoneNumber,
              templateKey,
              variables,
              applicantId: data.id
            }).catch(err => {
              console.error('Error sending WhatsApp notification:', err);
            });
          }

          if (newStatus === 'submitted' || newStatus === 'approved') {
            sendDocumentsAvailableNotification(data.id).then(result => {
              if (result.success) {
                console.log('✓ Document availability notification sent');
              } else {
                console.warn('⚠ Document notification failed:', result.error);
              }
            }).catch(err => {
              console.warn('⚠ Error sending document notification:', err);
            });
          }
        }
      }

      await fetchApplicants();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDelete = async (applicantId: string) => {
    try {
      const { error } = await supabase
        .from('applicants')
        .delete()
        .eq('id', applicantId);

      if (error) throw error;

      await fetchApplicants();
    } catch (error) {
      console.error('Error deleting applicant:', error);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedApplicants.size === 0) return;

    try {
      const ids = Array.from(selectedApplicants);

      for (const id of ids) {
        await supabase
          .from('applicants')
          .update({ status: newStatus })
          .eq('id', id);
      }

      await fetchApplicants();
      setSelectedApplicants(new Set());
      setShowBulkActions(false);
      alert(`Berhasil mengubah status ${ids.length} pendaftar`);
    } catch (error) {
      console.error('Error bulk updating status:', error);
      alert('Gagal mengubah status');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedApplicants.size === 0) return;

    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedApplicants.size} pendaftar?`)) {
      return;
    }

    try {
      const ids = Array.from(selectedApplicants);

      for (const id of ids) {
        await supabase
          .from('applicants')
          .delete()
          .eq('id', id);
      }

      await fetchApplicants();
      setSelectedApplicants(new Set());
      setShowBulkActions(false);
      alert(`Berhasil menghapus ${ids.length} pendaftar`);
    } catch (error) {
      console.error('Error bulk deleting:', error);
      alert('Gagal menghapus data');
    }
  };

  const handleBulkExport = () => {
    const selected = applicants.filter(a => selectedApplicants.has(a.id));
    const report = exportApplicantsToExcel(selected, 'Selected_Applicants');

    const qualityMessage = report.missingEmail > 0 || report.missingPhone > 0 || report.missingParentPhone > 0
      ? `\n\nPerhatian: ${report.missingEmail} data tanpa email, ${report.missingPhone} tanpa HP siswa, ${report.missingParentPhone} tanpa HP orang tua.`
      : '\n\nSemua data lengkap.';

    alert(`Export ${selected.length} pendaftar selesai.${qualityMessage}`);
  };

  const handleSelectAll = () => {
    if (selectedApplicants.size === filteredApplicants.length) {
      setSelectedApplicants(new Set());
    } else {
      setSelectedApplicants(new Set(filteredApplicants.map(a => a.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedApplicants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedApplicants(newSelected);
  };

  const applyFilters = (applicants: Applicant[]): Applicant[] => {
    let filtered = [...applicants];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(a => {
        const name = getFieldValue(a.dynamic_data, FIELD_NAMES.NAMA_LENGKAP)?.toLowerCase() || '';
        const nisn = getFieldValue(a.dynamic_data, FIELD_NAMES.NISN)?.toLowerCase() || '';
        const email = a.profiles?.email?.toLowerCase() || '';
        const phone = getFieldValue(a.dynamic_data, FIELD_NAMES.NO_TELEPON)?.toLowerCase() || '';
        const regNumber = a.registration_number?.toLowerCase() || '';

        return name.includes(query) || nisn.includes(query) ||
          email.includes(query) ||
          regNumber.includes(query) ||
          phone.includes(query);
      });
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(a => a.status === filters.status);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(a => new Date(a.created_at) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(a => new Date(a.created_at) <= toDate);
    }

    return filtered;
  };

  const filteredApplicants = applyFilters(
    selectedStatus === 'all' ? applicants : applicants.filter(a => a.status === selectedStatus)
  );

  const clearFilters = () => {
    setFilters({
      searchQuery: '',
      status: 'all',
      dateFrom: '',
      dateTo: ''
    });
    setSelectedStatus('all');
  };

  const activeFilterCount = [
    filters.searchQuery,
    filters.status !== 'all' ? filters.status : '',
    filters.dateFrom,
    filters.dateTo
  ].filter(Boolean).length;

  const columns: Column<Applicant>[] = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={selectedApplicants.size === filteredApplicants.length && filteredApplicants.length > 0}
          onChange={handleSelectAll}
          className="rounded border-slate-300 text-blue-600"
        />
      ),
      render: (item) => (
        <input
          type="checkbox"
          checked={selectedApplicants.has(item.id)}
          onChange={() => handleSelectOne(item.id)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-slate-300 text-blue-600"
        />
      )
    },
    {
      key: 'registration_number',
      label: 'No. Pendaftaran',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm text-slate-700">
          {item.registration_number || '-'}
        </span>
      )
    },
    {
      key: 'dynamic_data.nama_lengkap',
      label: 'Nama',
      sortable: true,
      render: (item) => (
        <div className="font-medium text-slate-800">
          {getFieldValue(item.dynamic_data, FIELD_NAMES.NAMA_LENGKAP) || 'N/A'}
        </div>
      )
    },
    {
      key: 'dynamic_data.nisn',
      label: 'NISN',
      sortable: true,
      render: (item) => getFieldValue(item.dynamic_data, FIELD_NAMES.NISN) || 'N/A'
    },
    {
      key: 'profiles.email',
      label: 'Email',
      render: (item) => (
        <span className="text-slate-600">
          {item.profiles?.email || 'N/A'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} size="sm" />
          <select
            value={item.status}
            onChange={(e) => {
              e.stopPropagation();
              handleStatusChange(item.id, e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="review">Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Tanggal Daftar',
      sortable: true,
      render: (item) => new Date(item.created_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedApplicant(item);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Lihat Detail"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialog({ isOpen: true, applicantId: item.id });
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Hapus"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const statusCounts = {
    all: applicants.length,
    draft: applicants.filter(a => a.status === 'draft').length,
    submitted: applicants.filter(a => a.status === 'submitted').length,
    review: applicants.filter(a => a.status === 'review').length,
    approved: applicants.filter(a => a.status === 'approved').length,
    rejected: applicants.filter(a => a.status === 'rejected').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Memuat data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manajemen Siswa</h2>
          <p className="text-slate-600 mt-1">Kelola data pendaftar PPDB</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchApplicants()}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh data"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${showFilterPanel
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
          >
            <Filter className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <span className="bg-white text-blue-600 rounded-full px-2 py-0.5 text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setExportDialog(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Data
          </button>
        </div>
      </div>

      {showFilterPanel && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Advanced Filters</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  placeholder="Nama, NISN, Email, Telepon..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="review">Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tanggal Dari
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tanggal Sampai
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              Showing {filteredApplicants.length} of {applicants.length} applicants
            </span>
          </div>
        </div>
      )}

      {selectedApplicants.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-blue-900">
                {selectedApplicants.size} pendaftar dipilih
              </span>
              <button
                onClick={() => setSelectedApplicants(new Set())}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear Selection
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                Bulk Actions
                <ChevronDown className="h-4 w-4" />
              </button>

              {showBulkActions && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                  <div className="p-2">
                    <button
                      onClick={() => handleBulkStatusChange('approved')}
                      className="w-full text-left px-4 py-2 hover:bg-emerald-50 rounded-lg text-emerald-700 flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve Selected
                    </button>
                    <button
                      onClick={() => handleBulkStatusChange('rejected')}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 rounded-lg text-red-700 flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Reject Selected
                    </button>
                    <button
                      onClick={() => handleBulkStatusChange('review')}
                      className="w-full text-left px-4 py-2 hover:bg-amber-50 rounded-lg text-amber-700 flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Set to Review
                    </button>
                    <hr className="my-2" />
                    <button
                      onClick={handleBulkExport}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 rounded-lg text-blue-700 flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export Selected
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 rounded-lg text-red-700 flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { key: 'all', label: 'Semua', color: 'bg-slate-100 text-slate-700' },
          { key: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700' },
          { key: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
          { key: 'review', label: 'Review', color: 'bg-amber-100 text-amber-700' },
          { key: 'approved', label: 'Diterima', color: 'bg-emerald-100 text-emerald-700' },
          { key: 'rejected', label: 'Ditolak', color: 'bg-red-100 text-red-700' }
        ].map(status => (
          <button
            key={status.key}
            onClick={() => setSelectedStatus(status.key)}
            className={`p-4 rounded-xl border-2 transition-all ${selectedStatus === status.key
              ? 'border-blue-500 shadow-md'
              : 'border-slate-200 hover:border-slate-300'
              }`}
          >
            <div className={`text-2xl font-bold ${status.color.split(' ')[1]}`}>
              {statusCounts[status.key as keyof typeof statusCounts]}
            </div>
            <div className="text-sm text-slate-600 mt-1">{status.label}</div>
          </button>
        ))}
      </div>

      <DataTable
        data={filteredApplicants}
        columns={columns}
        searchable={true}
        searchPlaceholder="Cari nama, NISN, atau email..."
        emptyMessage="Belum ada pendaftar"
      />

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, applicantId: null })}
        onConfirm={() => {
          if (deleteDialog.applicantId) {
            handleDelete(deleteDialog.applicantId);
          }
        }}
        title="Hapus Data Pendaftar"
        message="Apakah Anda yakin ingin menghapus data pendaftar ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        variant="danger"
      />

      {selectedApplicant && (
        <StudentDetailModal
          applicant={selectedApplicant}
          onClose={() => setSelectedApplicant(null)}
          onStatusChange={async (status) => {
            await handleStatusChange(selectedApplicant.id, status);
            setSelectedApplicant(null);
          }}
          onUpdated={fetchApplicants}
        />
      )}

      {exportDialog && (
        <ExportDialog
          applicants={applicants}
          onClose={() => setExportDialog(false)}
        />
      )}
    </div>
  );
};

interface StudentDetailModalProps {
  applicant: Applicant;
  onClose: () => void;
  onUpdated: () => void;
  onStatusChange: (status: string) => void;
}

const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ applicant, onClose, onUpdated, onStatusChange }) => {
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [comment, setComment] = useState(applicant.admin_comments || '');
  const [savingComment, setSavingComment] = useState(false);
  const [commentSaved, setCommentSaved] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState(true);

  useEffect(() => {
    const loadImageUrls = async () => {
      if (!applicant.dynamic_data) {
        setLoadingImages(false);
        return;
      }

      const urls: Record<string, string> = {};
      const imageFields = Object.entries(applicant.dynamic_data).filter(
        ([_, value]) => isImagePath(value)
      );

      await Promise.all(
        imageFields.map(async ([key, value]) => {
          const signedUrl = await getSignedImageUrl(String(value));
          if (signedUrl) {
            urls[key] = signedUrl;
          }
        })
      );

      setImageUrls(urls);
      setLoadingImages(false);
    };

    loadImageUrls();
  }, [applicant]);

  const handleSaveComment = async () => {
    try {
      setSavingComment(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('Anda harus login untuk menyimpan komentar');
        return;
      }

      const { error, data } = await supabase
        .from('applicants')
        .update({
          admin_comments: comment || null,
          commented_by: comment ? user.id : null,
          commented_at: comment ? new Date().toISOString() : null
        })
        .eq('id', applicant.id)
        .select('*, dynamic_data, registration_number, status')
        .single();

      if (error) throw error;

      if (data && comment && data.status === 'draft') {
        const phoneNumber = getFieldValue(data.dynamic_data, FIELD_NAMES.NO_TELEPON);
        const namaLengkap = getFieldValue(data.dynamic_data, FIELD_NAMES.NAMA_LENGKAP);

        if (phoneNumber) {
          sendWhatsAppNotification({
            phone: phoneNumber,
            templateKey: 'application_needs_revision',
            variables: {
              nama_lengkap: namaLengkap || 'Calon Siswa',
              registration_number: data.registration_number || 'Belum tersedia',
              admin_comments: comment
            },
            applicantId: data.id
          }).catch(err => {
            console.error('Error sending WhatsApp notification:', err);
          });
        }
      }

      setCommentSaved(true);
      if (onUpdated) onUpdated();
      setTimeout(() => {
        setCommentSaved(false);
      }, 2000);
    } catch (error) {
      console.error('Error saving comment:', error);
      alert('Gagal menyimpan komentar');
    } finally {
      setSavingComment(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Detail Pendaftar</h3>
              <p className="text-sm text-slate-600 mt-1">{applicant.profiles?.email || 'N/A'}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(applicant.dynamic_data || {}).map(([key, value]) => {
                const isImage = isImagePath(value);
                const imageUrl = isImage ? imageUrls[key] : null;

                return (
                  <div key={key} className={isImage ? 'md:col-span-2' : 'space-y-1'}>
                    <label className="text-sm font-medium text-slate-700 capitalize block mb-2">
                      {key.replace(/_/g, ' ')}
                    </label>
                    {isImage ? (
                      imageUrl ? (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                          <img
                            src={imageUrl}
                            alt={key}
                            className="max-w-full h-auto max-h-96 object-contain mx-auto rounded-lg shadow-md"
                          />
                        </div>
                      ) : loadingImages ? (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center text-slate-500">
                          Memuat gambar...
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3 rounded-lg text-slate-500">
                          Gambar tidak tersedia
                        </div>
                      )
                    ) : (
                      <div className="text-slate-900 bg-slate-50 p-3 rounded-lg">
                        {String(value)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <label className="text-sm font-medium text-slate-700 block mb-2">
                Ubah Status
              </label>
              <div className="flex gap-2">
                {['draft', 'submitted', 'review', 'approved', 'rejected'].map(status => (
                  <button
                    key={status}
                    onClick={() => onStatusChange(status)}
                    className={`px-4 py-2 rounded-lg transition-colors ${applicant.status === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Komentar untuk Siswa
                </label>
                <span className="text-xs text-slate-500">
                  {comment.length} karakter
                </span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tulis catatan atau feedback untuk siswa..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={4}
              />
              {applicant.commented_at && (
                <p className="text-xs text-slate-500 mt-2">
                  Terakhir diperbarui: {new Date(applicant.commented_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
              <button
                onClick={handleSaveComment}
                disabled={savingComment || comment === applicant.admin_comments}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {savingComment ? 'Menyimpan...' : commentSaved ? 'Tersimpan!' : 'Simpan Komentar'}
              </button>
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 flex justify-between gap-3">
            <button
              onClick={() => setShowLetterModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Generate Surat
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {showLetterModal && (
        <LetterGenerationModal
          applicant={applicant}
          onClose={() => setShowLetterModal(false)}
        />
      )}
    </>
  );
};

interface ExportDialogProps {
  applicants: Applicant[];
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ applicants, onClose }) => {
  const [exporting, setExporting] = useState(false);

  const handleExportAll = () => {
    setExporting(true);
    try {
      const report = exportApplicantsToExcel(applicants, 'Semua_Pendaftar');

      const qualityMessage = report.missingEmail > 0 || report.missingPhone > 0 || report.missingParentPhone > 0
        ? `Perhatian: ${report.missingEmail} data tanpa email, ${report.missingPhone} tanpa HP siswa, ${report.missingParentPhone} tanpa HP orang tua. Periksa console untuk detail.`
        : 'Semua data lengkap!';

      setTimeout(() => {
        setExporting(false);
        alert(`Export selesai! ${applicants.length} data berhasil di-export.\n\n${qualityMessage}`);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Gagal export data');
      setExporting(false);
    }
  };

  const handleExportAccepted = () => {
    setExporting(true);
    try {
      const report = exportAcceptedApplicantsToExcel(applicants);
      const acceptedCount = applicants.filter(a => a.status === 'approved' || a.status === 'accepted').length;

      const qualityMessage = report.missingEmail > 0 || report.missingPhone > 0 || report.missingParentPhone > 0
        ? `Perhatian: ${report.missingEmail} data tanpa email, ${report.missingPhone} tanpa HP siswa, ${report.missingParentPhone} tanpa HP orang tua. Periksa console untuk detail.`
        : 'Semua data lengkap!';

      setTimeout(() => {
        setExporting(false);
        alert(`Export selesai! ${acceptedCount} data diterima berhasil di-export.\n\n${qualityMessage}`);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Gagal export data');
      setExporting(false);
    }
  };

  const handleExportByStatus = (status: string) => {
    setExporting(true);
    try {
      const filtered = applicants.filter(a => a.status === status);
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      const report = exportApplicantsToExcel(filtered, `Pendaftar_${statusLabel}`);

      const qualityMessage = report.missingEmail > 0 || report.missingPhone > 0 || report.missingParentPhone > 0
        ? `Perhatian: ${report.missingEmail} data tanpa email, ${report.missingPhone} tanpa HP siswa, ${report.missingParentPhone} tanpa HP orang tua. Periksa console untuk detail.`
        : 'Semua data lengkap!';

      setTimeout(() => {
        setExporting(false);
        alert(`Export selesai! ${filtered.length} data status ${statusLabel} berhasil di-export.\n\n${qualityMessage}`);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Gagal export data');
      setExporting(false);
    }
  };

  const statusCounts = {
    all: applicants.length,
    approved: applicants.filter(a => a.status === 'approved').length,
    rejected: applicants.filter(a => a.status === 'rejected').length,
    submitted: applicants.filter(a => a.status === 'submitted').length,
    review: applicants.filter(a => a.status === 'review').length
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Export Data ke Excel</h3>
          <p className="text-sm text-slate-600 mt-1">
            Pilih data yang ingin Anda export
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleExportAll}
              disabled={exporting}
              className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold text-slate-800">Semua Data</h4>
                  </div>
                  <p className="text-sm text-slate-600">
                    Export semua pendaftar
                  </p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    {statusCounts.all}
                  </p>
                </div>
                <Download className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </button>

            <button
              onClick={handleExportAccepted}
              disabled={exporting || statusCounts.approved === 0}
              className="p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <h4 className="font-semibold text-slate-800">Diterima</h4>
                  </div>
                  <p className="text-sm text-slate-600">
                    Export yang diterima
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 mt-2">
                    {statusCounts.approved}
                  </p>
                </div>
                <Download className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
            </button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Export by Status</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { status: 'submitted', label: 'Submitted', color: 'blue', count: statusCounts.submitted },
                { status: 'review', label: 'Review', color: 'amber', count: statusCounts.review },
                { status: 'rejected', label: 'Rejected', color: 'red', count: statusCounts.rejected }
              ].map(({ status, label, color, count }) => (
                <button
                  key={status}
                  onClick={() => handleExportByStatus(status)}
                  disabled={exporting || count === 0}
                  className={`p-3 border border-slate-200 rounded-lg hover:bg-${color}-50 hover:border-${color}-300 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="text-sm font-medium text-slate-700">{label}</div>
                  <div className={`text-lg font-bold text-${color}-600`}>{count}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Catatan:</strong> File Excel akan berisi data lengkap pendaftar termasuk nama, NISN,
              kontak, alamat, data orang tua, dan statistik. Format otomatis dengan styling profesional.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  );
};
