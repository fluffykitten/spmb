import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import { Users, PlayCircle, FileText, Filter, RefreshCw, Calendar, User } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
    return localStorage.getItem('auth_token');
}

async function apiFetch(path: string) {
    const token = getToken();
    const resp = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (!resp.ok) throw new Error(`API Error: ${resp.status}`);
    return resp.json();
}

interface Interview {
    id: string;
    applicant_id: string | null;
    candidate_name: string;
    candidate_registration_no: string;
    candidate_origin_school: string;
    candidate_birth_date: string | null;
    candidate_parent_name: string;
    status: 'draft' | 'in_progress' | 'completed';
    total_score: number;
    weighted_score: number;
    interviewer_name: string;
    interviewer_email: string;
    created_at: string;
    updated_at: string;
}

export default function InterviewListPage() {
    const navigate = useNavigate();
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const { selectedYearId } = useAcademicYear();

    useEffect(() => {
        loadInterviews();
    }, [selectedYearId]);

    const loadInterviews = async () => {
        try {
            setLoading(true);
            const query = selectedYearId ? `?academic_year_id=${selectedYearId}` : '';
            const result = await apiFetch(`/api/wawancara/interviews${query}`);
            setInterviews(result.data || []);
        } catch (err) {
            console.error('Error loading interviews:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredInterviews = filterStatus === 'all'
        ? interviews
        : interviews.filter(i => i.status === filterStatus);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">Draft</span>;
            case 'in_progress':
                return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Sedang Berlangsung</span>;
            case 'completed':
                return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Selesai</span>;
            default:
                return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{status}</span>;
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const statusCounts = {
        all: interviews.length,
        draft: interviews.filter(i => i.status === 'draft').length,
        in_progress: interviews.filter(i => i.status === 'in_progress').length,
        completed: interviews.filter(i => i.status === 'completed').length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Daftar Wawancara</h1>
                    <p className="text-slate-500 mt-1">Kelola dan mulai sesi wawancara kandidat</p>
                </div>
                <button
                    onClick={loadInterviews}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total', count: statusCounts.all, color: 'bg-blue-50 text-blue-700 border-blue-200', filter: 'all' },
                    { label: 'Draft', count: statusCounts.draft, color: 'bg-slate-50 text-slate-700 border-slate-200', filter: 'draft' },
                    { label: 'Berlangsung', count: statusCounts.in_progress, color: 'bg-amber-50 text-amber-700 border-amber-200', filter: 'in_progress' },
                    { label: 'Selesai', count: statusCounts.completed, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', filter: 'completed' },
                ].map(stat => (
                    <button
                        key={stat.filter}
                        onClick={() => setFilterStatus(stat.filter)}
                        className={`p-4 rounded-xl border text-left transition-all ${stat.color} ${filterStatus === stat.filter ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                    >
                        <p className="text-2xl font-bold">{stat.count}</p>
                        <p className="text-sm opacity-80">{stat.label}</p>
                    </button>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600">Filter:</span>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
                >
                    <option value="all">Semua Status</option>
                    <option value="draft">Draft</option>
                    <option value="in_progress">Sedang Berlangsung</option>
                    <option value="completed">Selesai</option>
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-slate-600">Memuat data wawancara...</p>
                    </div>
                </div>
            ) : filteredInterviews.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                    <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Belum ada data wawancara</p>
                    <p className="text-sm text-slate-500 mt-1">Wawancara akan otomatis muncul setelah admin menyetujui pengajuan interview siswa.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Kandidat</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">No. Pendaftaran</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Asal Sekolah</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Interviewer</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Skor</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tanggal</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredInterviews.map(interview => (
                                    <tr key={interview.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800 text-sm">{interview.candidate_name || '-'}</p>
                                                    {interview.candidate_parent_name && (
                                                        <p className="text-xs text-slate-500">Ortu: {interview.candidate_parent_name}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700">{interview.candidate_registration_no || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-700">{interview.candidate_origin_school || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-700">{interview.interviewer_name || '-'}</td>
                                        <td className="px-4 py-3">{getStatusBadge(interview.status)}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {interview.status === 'completed' ? (
                                                <span className="font-semibold text-emerald-700">
                                                    {Number(interview.weighted_score).toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {formatDate(interview.updated_at)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                {interview.status !== 'completed' ? (
                                                    <button
                                                        onClick={() => navigate(`/admin/interview-session/${interview.id}`)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        <PlayCircle className="h-3.5 w-3.5" />
                                                        Mulai
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => navigate(`/admin/interview-report/${interview.id}`)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                                                    >
                                                        <FileText className="h-3.5 w-3.5" />
                                                        Laporan
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
