import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import { FileText, Plus, Edit, Trash2, Clock, CheckCircle, ClipboardCheck } from 'lucide-react';
import { QuestionManager } from '../../components/admin/QuestionManager';
import { ExamGrading } from '../../components/admin/ExamGrading';

interface Exam {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
}

export const ExamBuilder: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingExam, setEditingExam] = useState<{ id: string; title: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'exams' | 'grading'>('exams');
  const { selectedYearId, activeYear } = useAcademicYear();

  useEffect(() => {
    fetchExams();
  }, [selectedYearId]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('academic_year_id', selectedYearId || '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus ujian ini?')) return;

    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchExams();
    } catch (error) {
      console.error('Error deleting exam:', error);
      alert('Gagal menghapus ujian');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const { error } = await supabase
        .from('exams')
        .update({ status: 'published' })
        .eq('id', id);

      if (error) throw error;
      fetchExams();
    } catch (error) {
      console.error('Error publishing exam:', error);
    }
  };

  const filteredExams = filterStatus === 'all'
    ? exams
    : exams.filter(e => e.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-emerald-100 text-emerald-700';
      case 'draft': return 'bg-slate-100 text-slate-700';
      case 'archived': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Exam Management</h2>
          <p className="text-slate-600 mt-1">Kelola ujian online dan nilai hasil ujian siswa</p>
        </div>
        {activeTab === 'exams' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Buat Ujian Baru
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('exams')}
          className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'exams'
            ? 'text-blue-600'
            : 'text-slate-600 hover:text-slate-800'
            }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span>Kelola Ujian</span>
          </div>
          {activeTab === 'exams' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('grading')}
          className={`px-6 py-3 font-medium transition-colors relative ${activeTab === 'grading'
            ? 'text-blue-600'
            : 'text-slate-600 hover:text-slate-800'
            }`}
        >
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            <span>Penilaian</span>
          </div>
          {activeTab === 'grading' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
      </div>

      {activeTab === 'exams' ? (
        <>
          <div className="flex gap-2">
            {['all', 'draft', 'published', 'archived'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg transition-colors ${filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-2 font-semibold">
                  ({status === 'all' ? exams.length : exams.filter(e => e.status === status).length})
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam) => (
              <div key={exam.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-slate-800">{exam.title}</h3>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(exam.status)}`}>
                    {exam.status}
                  </span>
                </div>

                {exam.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{exam.description}</p>
                )}

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Durasi: {exam.duration_minutes} menit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Passing Score: {exam.passing_score}%</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 flex gap-2">
                  {exam.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(exam.id)}
                      className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => setEditingExam({ id: exam.id, title: exam.title })}
                    className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm flex items-center justify-center gap-1"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Soal
                  </button>
                  <button
                    onClick={() => handleDelete(exam.id)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredExams.length === 0 && (
            <div className="text-center py-12 bg-slate-50 rounded-xl">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Belum ada ujian</p>
            </div>
          )}
        </>
      ) : (
        <ExamGrading />
      )}

      {showCreateModal && (
        <CreateExamModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchExams();
          }}
          academicYearId={activeYear?.id || selectedYearId || null}
        />
      )}

      {editingExam && (
        <QuestionManager
          examId={editingExam.id}
          examTitle={editingExam.title}
          onClose={() => setEditingExam(null)}
        />
      )}
    </div>
  );
};

interface CreateExamModalProps {
  onClose: () => void;
  onSuccess: () => void;
  academicYearId: string | null;
}

const CreateExamModal: React.FC<CreateExamModalProps> = ({ onClose, onSuccess, academicYearId }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: 'Baca setiap soal dengan cermat dan pilih jawaban yang paling tepat.',
    duration_minutes: 60,
    passing_score: 70,
    max_attempts: 1,
    randomize_questions: false,
    randomize_options: false,
    show_results_immediately: false,
    show_correct_answers: false,
    enable_proctoring: true,
    require_fullscreen: true
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('exams')
        .insert({
          ...formData,
          created_by: user.id,
          status: 'draft',
          target_audience: 'all',
          academic_year_id: academicYearId,
        });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error creating exam:', error);
      alert('Gagal membuat ujian');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Buat Ujian Baru</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Judul Ujian</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ujian Masuk 2024"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Deskripsi</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              rows={2}
              placeholder="Deskripsi singkat tentang ujian"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Petunjuk Ujian</label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Durasi (menit)</label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                min="1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Passing Score (%)</label>
              <input
                type="number"
                value={formData.passing_score}
                onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 70 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                min="0"
                max="100"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Maksimal Percobaan</label>
            <input
              type="number"
              value={formData.max_attempts}
              onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              min="1"
              max="5"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.randomize_questions}
                onChange={(e) => setFormData({ ...formData, randomize_questions: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-700">Acak urutan soal</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.randomize_options}
                onChange={(e) => setFormData({ ...formData, randomize_options: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-700">Acak urutan pilihan jawaban</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.show_results_immediately}
                onChange={(e) => setFormData({ ...formData, show_results_immediately: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-700">Tampilkan hasil langsung setelah submit</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.show_correct_answers}
                onChange={(e) => setFormData({ ...formData, show_correct_answers: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-700">Tampilkan jawaban yang benar</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.enable_proctoring}
                onChange={(e) => setFormData({ ...formData, enable_proctoring: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-700">Aktifkan monitoring dasar</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.require_fullscreen}
                onChange={(e) => setFormData({ ...formData, require_fullscreen: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm text-slate-700">Wajib fullscreen</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Ujian'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
