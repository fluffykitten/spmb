import React, { useState, useEffect } from 'react';
import { Users, FileText, Clock, CheckCircle, Calendar, ClipboardCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAcademicYear } from '../../contexts/AcademicYearContext';

interface DashboardStats {
  totalApplicants: number;
  pendingVerification: number;
  accepted: number;
  rejected: number;
  totalTemplates: number;
  pendingInterviews: number;
  pendingExamGrading: number;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalApplicants: 0,
    pendingVerification: 0,
    accepted: 0,
    rejected: 0,
    totalTemplates: 0,
    pendingInterviews: 0,
    pendingExamGrading: 0
  });
  const [loading, setLoading] = useState(true);
  const { selectedYearId } = useAcademicYear();

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'applicants' },
        () => fetchStats()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'letter_templates' },
        () => fetchStats()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'interview_requests' },
        () => fetchStats()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'exam_attempts' },
        () => fetchStats()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'exam_answers' },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedYearId]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const applicantsBase = () => {
        let q = supabase.from('applicants').select('*', { count: 'exact', head: true });
        if (selectedYearId) q = q.eq('academic_year_id', selectedYearId);
        return q;
      };

      const [
        totalResult,
        pendingResult,
        acceptedResult,
        rejectedResult,
        templatesResult,
        interviewsResult,
        pendingGradingResult
      ] = await Promise.all([
        applicantsBase(),
        (() => { let q = supabase.from('applicants').select('*', { count: 'exact', head: true }).in('status', ['draft', 'submitted', 'pending']); if (selectedYearId) q = q.eq('academic_year_id', selectedYearId); return q; })(),
        (() => { let q = supabase.from('applicants').select('*', { count: 'exact', head: true }).eq('status', 'accepted'); if (selectedYearId) q = q.eq('academic_year_id', selectedYearId); return q; })(),
        (() => { let q = supabase.from('applicants').select('*', { count: 'exact', head: true }).eq('status', 'rejected'); if (selectedYearId) q = q.eq('academic_year_id', selectedYearId); return q; })(),
        supabase
          .from('letter_templates')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('interview_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_review'),
        supabase
          .from('exam_results')
          .select('*', { count: 'exact', head: true })
          .in('grading_status', ['pending', 'partial'])
      ]);

      console.log('[AdminDashboard] Pending grading count:', pendingGradingResult.count);

      setStats({
        totalApplicants: totalResult.count || 0,
        pendingVerification: pendingResult.count || 0,
        accepted: acceptedResult.count || 0,
        rejected: rejectedResult.count || 0,
        totalTemplates: templatesResult.count || 0,
        pendingInterviews: interviewsResult.count || 0,
        pendingExamGrading: pendingGradingResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Administrator</h2>
        <p className="text-slate-600 mt-1">Selamat datang di panel administrator PPDB</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Pendaftar</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">
                {loading ? '...' : stats.totalApplicants}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Menunggu Verifikasi</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">
                {loading ? '...' : stats.pendingVerification}
              </p>
            </div>
            <div className="h-12 w-12 bg-amber-50 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Diterima</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">
                {loading ? '...' : stats.accepted}
              </p>
            </div>
            <div className="h-12 w-12 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Template Surat</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">
                {loading ? '...' : stats.totalTemplates}
              </p>
            </div>
            <div className="h-12 w-12 bg-slate-50 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Interview</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">
                {loading ? '...' : stats.pendingInterviews}
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Penilaian Exam</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">
                {loading ? '...' : stats.pendingExamGrading}
              </p>
            </div>
            <div className="h-12 w-12 bg-orange-50 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Aktivitas Terbaru</h3>
        <div className="text-center py-12">
          <p className="text-slate-500">Belum ada aktivitas</p>
        </div>
      </div>
    </div>
  );
};
