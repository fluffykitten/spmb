import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Calendar, DollarSign, Users, CheckCircle, XCircle, RefreshCw, CreditCard, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../components/shared/PaymentComponents';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { useAcademicYear } from '../../contexts/AcademicYearContext';

interface RegistrationBatch {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  entrance_fee_amount: number;
  administration_fee_amount: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface BatchFormData {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  entrance_fee_amount: string;
  administration_fee_amount: string;
  is_active: boolean;
  display_order: string;
}

export const RegistrationBatchManagement: React.FC = () => {
  const [batches, setBatches] = useState<RegistrationBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState<RegistrationBatch | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  const [batchStats, setBatchStats] = useState<Record<string, any>>({});
  const [processingBatch, setProcessingBatch] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { selectedYearId, activeYear } = useAcademicYear();

  const [formData, setFormData] = useState<BatchFormData>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    entrance_fee_amount: '',
    administration_fee_amount: '',
    is_active: true,
    display_order: '0',
  });

  const [errors, setErrors] = useState<Partial<BatchFormData>>({});

  useEffect(() => {
    fetchBatches();
  }, [selectedYearId]);

  const fetchBatches = async () => {
    try {
      setLoading(true);

      let batchQuery = supabase
        .from('registration_batches')
        .select('*')
        .order('display_order', { ascending: true });
      if (selectedYearId) batchQuery = batchQuery.eq('academic_year_id', selectedYearId);
      const { data: batchData, error: batchError } = await batchQuery;

      if (batchError) throw batchError;

      setBatches(batchData || []);

      const { data: countData } = await supabase
        .from('applicants')
        .select('registration_batch_id')
        .not('registration_batch_id', 'is', null);

      const counts: Record<string, number> = {};
      countData?.forEach((item) => {
        if (item.registration_batch_id) {
          counts[item.registration_batch_id] = (counts[item.registration_batch_id] || 0) + 1;
        }
      });

      setApplicantCounts(counts);

      // Fetch statistics for each batch
      if (batchData && batchData.length > 0) {
        const stats: Record<string, any> = {};
        for (const batch of batchData) {
          try {
            const { data: statData, error: statError } = await supabase.rpc('admin_get_batch_statistics', {
              p_batch_id: batch.id
            });
            if (!statError && statData) {
              stats[batch.id] = statData;
            }
          } catch (err) {
            console.error(`Error fetching stats for batch ${batch.id}:`, err);
          }
        }
        setBatchStats(stats);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<BatchFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nama gelombang wajib diisi';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Tanggal mulai wajib diisi';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'Tanggal selesai wajib diisi';
    }

    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      newErrors.end_date = 'Tanggal selesai harus setelah tanggal mulai';
    }

    if (!formData.entrance_fee_amount || parseFloat(formData.entrance_fee_amount) < 0) {
      newErrors.entrance_fee_amount = 'Biaya masuk harus diisi dan tidak boleh negatif';
    }

    if (!formData.administration_fee_amount || parseFloat(formData.administration_fee_amount) < 0) {
      newErrors.administration_fee_amount = 'Biaya administrasi harus diisi dan tidak boleh negatif';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const dataToSubmit = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        entrance_fee_amount: parseFloat(formData.entrance_fee_amount),
        administration_fee_amount: parseFloat(formData.administration_fee_amount),
        is_active: formData.is_active,
        display_order: parseInt(formData.display_order) || 0,
      };

      if (editingBatch) {
        const { error } = await supabase
          .from('registration_batches')
          .update(dataToSubmit)
          .eq('id', editingBatch.id);

        if (error) throw error;
      } else {
        const insertData = {
          ...dataToSubmit,
          academic_year_id: activeYear?.id || selectedYearId || null,
        };
        const { error } = await supabase
          .from('registration_batches')
          .insert([insertData]);

        if (error) throw error;
      }

      await fetchBatches();
      resetForm();
    } catch (error: any) {
      console.error('Error saving batch:', error);
      alert(error.message || 'Gagal menyimpan data gelombang pendaftaran');
    }
  };

  const handleEdit = (batch: RegistrationBatch) => {
    setEditingBatch(batch);
    setFormData({
      name: batch.name,
      description: batch.description || '',
      start_date: batch.start_date,
      end_date: batch.end_date,
      entrance_fee_amount: batch.entrance_fee_amount.toString(),
      administration_fee_amount: batch.administration_fee_amount.toString(),
      is_active: batch.is_active,
      display_order: batch.display_order.toString(),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('registration_batches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchBatches();
      setDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting batch:', error);
      alert(error.message || 'Gagal menghapus gelombang pendaftaran');
    }
  };

  const toggleActive = async (batch: RegistrationBatch) => {
    try {
      const { error } = await supabase
        .from('registration_batches')
        .update({ is_active: !batch.is_active })
        .eq('id', batch.id);

      if (error) throw error;

      await fetchBatches();
    } catch (error: any) {
      console.error('Error toggling batch status:', error);
      alert(error.message || 'Gagal mengubah status gelombang');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingBatch(null);
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      entrance_fee_amount: '',
      administration_fee_amount: '',
      is_active: true,
      display_order: '0',
    });
    setErrors({});
  };

  const handleBackfillBatch = async (batchId: string) => {
    if (!confirm('Ini akan menetapkan gelombang ini ke semua siswa yang mendaftar dalam rentang tanggal gelombang ini. Lanjutkan?')) {
      return;
    }

    try {
      setProcessingBatch(batchId);
      setActionResult(null);

      const { data, error } = await supabase.rpc('admin_backfill_batch_assignments', {
        p_batch_id: batchId
      });

      if (error) throw error;

      if (data.success) {
        const batches = data.batches_processed || [];
        const batch = batches[0];

        setActionResult({
          type: 'success',
          message: `Berhasil menetapkan ${batch?.assigned || 0} siswa ke ${batch?.batch_name || 'gelombang ini'}. ${batch?.already_assigned || 0} siswa sudah terdaftar sebelumnya.`
        });

        await fetchBatches();
      } else {
        throw new Error(data.error || 'Gagal menetapkan siswa ke gelombang');
      }
    } catch (error: any) {
      console.error('Error backfilling batch:', error);
      setActionResult({
        type: 'error',
        message: error.message || 'Gagal menetapkan siswa ke gelombang'
      });
    } finally {
      setProcessingBatch(null);
    }
  };

  const handleSyncPayments = async (batchId: string) => {
    if (!confirm('Ini akan membuat catatan pembayaran untuk semua siswa di gelombang ini yang belum memiliki catatan pembayaran. Lanjutkan?')) {
      return;
    }

    try {
      setProcessingBatch(batchId);
      setActionResult(null);

      const { data, error } = await supabase.rpc('admin_sync_batch_payments', {
        p_batch_id: batchId
      });

      if (error) throw error;

      if (data.success) {
        setActionResult({
          type: 'success',
          message: `Berhasil menginisialisasi pembayaran untuk ${data.initialized} siswa di ${data.batch_name}. ${data.already_had_payment} siswa sudah memiliki catatan pembayaran.`
        });

        await fetchBatches();
      } else {
        throw new Error(data.error || 'Gagal menginisialisasi pembayaran');
      }
    } catch (error: any) {
      console.error('Error syncing payments:', error);
      setActionResult({
        type: 'error',
        message: error.message || 'Gagal menginisialisasi pembayaran'
      });
    } finally {
      setProcessingBatch(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Kelola Gelombang Pendaftaran</h2>
          <p className="text-slate-600 mt-1">Atur gelombang pendaftaran dengan biaya yang berbeda</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Tambah Gelombang
        </button>
      </div>

      {actionResult && (
        <div className={`p-4 rounded-lg border ${actionResult.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-red-50 border-red-200 text-red-800'
          }`}>
          <div className="flex items-start gap-3">
            {actionResult.type === 'success' ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">{actionResult.message}</p>
            </div>
            <button
              onClick={() => setActionResult(null)}
              className="text-current opacity-60 hover:opacity-100 transition-opacity"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            {editingBatch ? 'Edit Gelombang Pendaftaran' : 'Tambah Gelombang Pendaftaran'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nama Gelombang <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.name ? 'border-red-300' : 'border-slate-300'
                    }`}
                  placeholder="Contoh: Gelombang 1"
                />
                {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Urutan Tampilan
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Deskripsi
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Deskripsi gelombang pendaftaran (opsional)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.start_date ? 'border-red-300' : 'border-slate-300'
                    }`}
                />
                {errors.start_date && <p className="text-sm text-red-600 mt-1">{errors.start_date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tanggal Selesai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.end_date ? 'border-red-300' : 'border-slate-300'
                    }`}
                />
                {errors.end_date && <p className="text-sm text-red-600 mt-1">{errors.end_date}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Biaya Masuk (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.entrance_fee_amount}
                  onChange={(e) => setFormData({ ...formData, entrance_fee_amount: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.entrance_fee_amount ? 'border-red-300' : 'border-slate-300'
                    }`}
                  min="0"
                  step="1000"
                  placeholder="0"
                />
                {errors.entrance_fee_amount && <p className="text-sm text-red-600 mt-1">{errors.entrance_fee_amount}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Biaya Administrasi (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.administration_fee_amount}
                  onChange={(e) => setFormData({ ...formData, administration_fee_amount: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.administration_fee_amount ? 'border-red-300' : 'border-slate-300'
                    }`}
                  min="0"
                  step="1000"
                  placeholder="0"
                />
                {errors.administration_fee_amount && <p className="text-sm text-red-600 mt-1">{errors.administration_fee_amount}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                Aktif
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingBatch ? 'Update' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {batches.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Belum Ada Gelombang Pendaftaran</h3>
            <p className="text-slate-600 mb-4">Mulai dengan menambahkan gelombang pendaftaran pertama</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Tambah Gelombang
            </button>
          </div>
        ) : (
          batches.map((batch) => (
            <div key={batch.id} className={`bg-white rounded-xl border-2 p-6 ${batch.is_active ? 'border-blue-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{batch.name}</h3>
                    {batch.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg">
                        <CheckCircle className="h-3 w-3" />
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
                        <XCircle className="h-3 w-3" />
                        Tidak Aktif
                      </span>
                    )}
                  </div>
                  {batch.description && (
                    <p className="text-sm text-slate-600 mb-3">{batch.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(batch)}
                    className={`p-2 rounded-lg transition-colors ${batch.is_active
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                      }`}
                    title={batch.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    {batch.is_active ? <XCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => handleEdit(batch)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(batch.id)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-slate-600" />
                    <span className="text-xs font-medium text-slate-600">Periode</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {new Date(batch.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' - '}
                    {new Date(batch.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-slate-600" />
                    <span className="text-xs font-medium text-slate-600">Total Biaya</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(Number(batch.entrance_fee_amount) + Number(batch.administration_fee_amount))}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Masuk: {formatCurrency(batch.entrance_fee_amount)} • Admin: {formatCurrency(batch.administration_fee_amount)}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-slate-600" />
                    <span className="text-xs font-medium text-slate-600">Pendaftar</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {applicantCounts[batch.id] || 0} siswa
                  </p>
                </div>
              </div>

              {batchStats[batch.id] && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {batchStats[batch.id].unassigned_in_date_range > 0 && (
                      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <span className="text-xs font-medium text-amber-900">Belum Terdaftar</span>
                        </div>
                        <p className="text-sm font-semibold text-amber-900">
                          {batchStats[batch.id].unassigned_in_date_range} siswa
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          Mendaftar dalam periode ini
                        </p>
                      </div>
                    )}

                    {batchStats[batch.id].without_payment_records > 0 && (
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="h-4 w-4 text-orange-600" />
                          <span className="text-xs font-medium text-orange-900">Belum Ada Pembayaran</span>
                        </div>
                        <p className="text-sm font-semibold text-orange-900">
                          {batchStats[batch.id].without_payment_records} siswa
                        </p>
                        <p className="text-xs text-orange-700 mt-1">
                          Perlu inisialisasi pembayaran
                        </p>
                      </div>
                    )}

                    {batchStats[batch.id].with_payment_records > 0 && (
                      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-medium text-emerald-900">Sudah Siap</span>
                        </div>
                        <p className="text-sm font-semibold text-emerald-900">
                          {batchStats[batch.id].with_payment_records} siswa
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">
                          Pembayaran sudah diinisialisasi
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {batchStats[batch.id].unassigned_in_date_range > 0 && (
                      <button
                        onClick={() => handleBackfillBatch(batch.id)}
                        disabled={processingBatch === batch.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingBatch === batch.id ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Memproses...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Tetapkan Siswa ({batchStats[batch.id].unassigned_in_date_range})
                          </>
                        )}
                      </button>
                    )}

                    {(batchStats[batch.id].without_payment_records > 0 || batchStats[batch.id].unassigned_in_date_range > 0) && (
                      <button
                        onClick={() => handleSyncPayments(batch.id)}
                        disabled={processingBatch === batch.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingBatch === batch.id ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Memproses...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            Inisialisasi Pembayaran
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {deleteConfirm && (
        <ConfirmDialog
          isOpen={!!deleteConfirm}
          title="Hapus Gelombang Pendaftaran"
          message="Apakah Anda yakin ingin menghapus gelombang pendaftaran ini? Siswa yang sudah terdaftar tidak akan terpengaruh, tetapi referensi ke gelombang ini akan dihapus."
          confirmText="Hapus"
          cancelText="Batal"
          onConfirm={() => handleDelete(deleteConfirm)}
          onClose={() => setDeleteConfirm(null)}
          variant="danger"
        />
      )}
    </div>
  );
};
