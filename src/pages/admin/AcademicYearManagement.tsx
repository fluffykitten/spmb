import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, Calendar, AlertCircle } from 'lucide-react';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';

interface AcademicYear {
    id: string;
    name: string;
    code: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    created_at: string;
}

interface FormData {
    name: string;
    code: string;
    start_date: string;
    end_date: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
    return localStorage.getItem('auth_token');
}

async function apiFetch(path: string, options: RequestInit = {}) {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const resp = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });
    return resp.json();
}

export const AcademicYearManagement: React.FC = () => {
    const { allYears, refreshYears, setSelectedYearId } = useAcademicYear();
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData>({ name: '', code: '', start_date: '', end_date: '' });
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        await refreshYears();
        setLoading(false);
    };

    const resetForm = () => {
        setFormData({ name: '', code: '', start_date: '', end_date: '' });
        setEditingId(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.code) {
            setMessage({ type: 'error', text: 'Nama dan kode wajib diisi' });
            return;
        }

        try {
            if (editingId) {
                const result = await apiFetch(`/api/academic-years/${editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData),
                });
                if (result.error) throw new Error(result.error);
                setMessage({ type: 'success', text: 'Tahun pelajaran berhasil diperbarui' });
            } else {
                const result = await apiFetch('/api/academic-years', {
                    method: 'POST',
                    body: JSON.stringify(formData),
                });
                if (result.error) throw new Error(result.error);
                setMessage({ type: 'success', text: 'Tahun pelajaran berhasil dibuat' });
            }
            resetForm();
            await refreshYears();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Gagal menyimpan' });
        }
        setTimeout(() => setMessage(null), 3000);
    };

    const handleEdit = (year: AcademicYear) => {
        setFormData({
            name: year.name,
            code: year.code,
            start_date: year.start_date || '',
            end_date: year.end_date || '',
        });
        setEditingId(year.id);
        setShowForm(true);
    };

    const handleDelete = (id: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Hapus Tahun Pelajaran',
            message: 'Apakah Anda yakin ingin menghapus tahun pelajaran ini? Tindakan ini tidak dapat dibatalkan.',
            onConfirm: async () => {
                try {
                    const result = await apiFetch(`/api/academic-years/${id}`, { method: 'DELETE' });
                    if (result.error) throw new Error(result.error);
                    setMessage({ type: 'success', text: 'Tahun pelajaran berhasil dihapus' });
                    await refreshYears();
                } catch (err: any) {
                    setMessage({ type: 'error', text: err.message || 'Gagal menghapus' });
                }
                setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { } });
                setTimeout(() => setMessage(null), 3000);
            }
        });
    };

    const handleActivate = (id: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Aktifkan Tahun Pelajaran',
            message: 'Mengaktifkan tahun pelajaran ini akan menonaktifkan tahun pelajaran lainnya. Semua pendaftaran baru akan menggunakan tahun pelajaran ini. Lanjutkan?',
            onConfirm: async () => {
                try {
                    const result = await apiFetch(`/api/academic-years/${id}/activate`, { method: 'PUT' });
                    if (result.error) throw new Error(result.error);
                    setMessage({ type: 'success', text: 'Tahun pelajaran berhasil diaktifkan' });
                    setSelectedYearId(id);
                    await refreshYears();
                } catch (err: any) {
                    setMessage({ type: 'error', text: err.message || 'Gagal mengaktifkan' });
                }
                setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { } });
                setTimeout(() => setMessage(null), 3000);
            }
        });
    };

    const generateCodeFromName = (name: string) => {
        // Try to extract years like "2025/2026" -> "2526"
        const match = name.match(/(\d{4})\s*[\/\-]\s*(\d{4})/);
        if (match) {
            return `${match[1].slice(-2)}${match[2].slice(-2)}`;
        }
        return '';
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
                    <h2 className="text-2xl font-bold text-slate-800">Tahun Pelajaran</h2>
                    <p className="text-slate-600 mt-1">Kelola tahun pelajaran untuk pendaftaran siswa baru</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="h-5 w-5" />
                    Tambah Tahun Pelajaran
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{message.text}</p>
                </div>
            )}

            {showForm && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                        {editingId ? 'Edit Tahun Pelajaran' : 'Tambah Tahun Pelajaran Baru'}
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Tahun Pelajaran *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => {
                                    const name = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        name,
                                        code: prev.code || generateCodeFromName(name)
                                    }));
                                }}
                                placeholder="e.g. 2025/2026"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Kode *</label>
                            <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                placeholder="e.g. 2526"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">Kode ini akan digunakan sebagai prefix nomor registrasi</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai</label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Akhir</label>
                            <input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {editingId ? 'Perbarui' : 'Simpan'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allYears.map((year) => (
                    <div
                        key={year.id}
                        className={`bg-white rounded-xl border-2 p-6 transition-all ${year.is_active
                            ? 'border-emerald-400 ring-2 ring-emerald-100'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${year.is_active ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                    <Calendar className={`h-5 w-5 ${year.is_active ? 'text-emerald-600' : 'text-slate-500'}`} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">{year.name}</h3>
                                    <p className="text-sm text-slate-500">Kode: {year.code}</p>
                                </div>
                            </div>
                            {year.is_active && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Aktif
                                </span>
                            )}
                        </div>

                        {(year.start_date || year.end_date) && (
                            <div className="text-sm text-slate-600 mb-4">
                                {year.start_date && (
                                    <span>Mulai: {new Date(year.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                )}
                                {year.start_date && year.end_date && <span className="mx-2">—</span>}
                                {year.end_date && (
                                    <span>Akhir: {new Date(year.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                            {!year.is_active && (
                                <button
                                    onClick={() => handleActivate(year.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    Aktifkan
                                </button>
                            )}
                            <button
                                onClick={() => handleEdit(year)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                <Edit2 className="h-4 w-4" />
                                Edit
                            </button>
                            {!year.is_active && (
                                <button
                                    onClick={() => handleDelete(year.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Hapus
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {allYears.length === 0 && (
                    <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center">
                        <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-600 mb-2">Belum Ada Tahun Pelajaran</h3>
                        <p className="text-slate-500 mb-4">Buat tahun pelajaran pertama untuk memulai</p>
                        <button
                            onClick={() => { resetForm(); setShowForm(true); }}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Tambah Tahun Pelajaran
                        </button>
                    </div>
                )}
            </div>

            {confirmDialog.isOpen && (
                <ConfirmDialog
                    isOpen={confirmDialog.isOpen}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onClose={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { } })}
                />
            )}
        </div>
    );
};
