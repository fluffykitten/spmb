import React, { useEffect, useState } from 'react';
import { FileEdit, AlertCircle, CheckCircle, Clock, Download, MessageSquare, Calendar, Video, MapPin, Edit2, DollarSign, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useStudentGenerations } from '../../hooks/useStudentGenerations';
import { format } from 'date-fns';
import { PaymentInfoCard, PaymentSummaryCard } from '../../components/shared/PaymentComponents';

interface ApplicationData {
  id: string;
  status: string;
  dynamic_data: Record<string, any>;
  registration_number: string | null;
  admin_comments: string | null;
  commented_by: string | null;
  commented_at: string | null;
  created_at: string;
  updated_at: string;
}

interface InterviewRequest {
  id: string;
  proposed_date: string;
  proposed_time_start: string;
  proposed_time_end: string;
  proposed_type: 'online' | 'offline';
  status: 'pending_review' | 'revision_requested' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  meeting_link: string | null;
  admin_notes: string | null;
  revision_requested_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
}

interface PaymentRecord {
  id: string;
  payment_type: 'entrance_fee' | 'administration_fee';
  payment_status: string;
  total_amount: number;
  paid_amount: number;
  payment_date?: string;
  payment_method?: string;
  payment_notes?: string;
}

interface ExamResult {
  id: string;
  attempt_id: string;
  total_points: number;
  max_points: number;
  percentage: number;
  passed: boolean | null;
  grading_status: 'pending' | 'partial' | 'completed';
  created_at: string;
  attempt: {
    exam_id: string;
    attempt_number: number;
    submitted_at: string;
    exam: {
      title: string;
      passing_score: number;
    };
  };
}

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [interviewRequest, setInterviewRequest] = useState<InterviewRequest | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [batchName, setBatchName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { totalGenerated, totalDownloaded } = useStudentGenerations();

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const { data: appData, error: appError } = await (supabase
        .from('applicants')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle() as any);

      if (appError) throw appError;
      setApplication(appData);

      if (appData) {
        if (appData.registration_batches) {
          setBatchName((appData.registration_batches as any).name);
        }

        const { data: interviewData } = await (supabase
          .from('interview_requests')
          .select('*')
          .eq('applicant_id', appData.id)
          .in('status', ['pending_review', 'revision_requested', 'approved'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle() as any);

        if (interviewData) {
          setInterviewRequest(interviewData);
        }

        const { data: paymentData } = await (supabase
          .from('payment_records')
          .select('*')
          .eq('applicant_id', appData.id)
          .order('payment_type', { ascending: true }) as any);

        if (paymentData) {
          setPaymentRecords(paymentData);
        }

        const { data: attemptsData } = await (supabase
          .from('exam_attempts')
          .select('id, exam_id, attempt_number, submitted_at')
          .eq('applicant_id', appData.id)
          .eq('status', 'completed') as any);

        if (attemptsData && attemptsData.length > 0) {
          const attemptIds = attemptsData.map((a: any) => a.id);
          const examIds = Array.from(new Set(attemptsData.map((a: any) => a.exam_id)));

          const { data: examsData } = await (supabase
            .from('exams')
            .select('id, title, passing_score')
            .in('id', examIds) as any);

          const { data: resultsData } = await (supabase
            .from('exam_results')
            .select('*')
            .in('attempt_id', attemptIds)
            .order('created_at', { ascending: false }) as any);

          if (resultsData) {
            const enrichedResults = resultsData.map((result: any) => {
              const attempt = attemptsData.find((a: any) => a.id === result.attempt_id);
              if (attempt) {
                const exam = examsData?.find((e: any) => e.id === attempt.exam_id);
                attempt.exam = exam || { title: 'Unknown Exam', passing_score: 0 };
              }
              return {
                ...result,
                attempt
              };
            });
            console.log('[StudentDashboard] Loaded exam results:', enrichedResults.length);
            setExamResults(enrichedResults);
          }
        } else {
          setExamResults([]);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCompleteness = (): number => {
    if (!application || !application.dynamic_data) return 0;

    const data = application.dynamic_data;
    const totalFields = Object.keys(data).length;
    const filledFields = Object.values(data).filter(value =>
      value !== null && value !== undefined && value !== ''
    ).length;

    return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  };

  const getStatusInfo = () => {
    if (!application) {
      return {
        label: 'Belum Mendaftar',
        color: 'bg-slate-100 text-slate-700',
        icon: Clock
      };
    }

    switch (application.status) {
      case 'submitted':
        return {
          label: 'Menunggu Verifikasi',
          color: 'bg-blue-100 text-blue-700',
          icon: Clock
        };
      case 'review':
        return {
          label: 'Dalam Review',
          color: 'bg-amber-100 text-amber-700',
          icon: AlertCircle
        };
      case 'approved':
        return {
          label: 'Diterima',
          color: 'bg-emerald-100 text-emerald-700',
          icon: CheckCircle
        };
      case 'rejected':
        return {
          label: 'Ditolak',
          color: 'bg-red-100 text-red-700',
          icon: AlertCircle
        };
      default:
        return {
          label: 'Draft',
          color: 'bg-slate-100 text-slate-700',
          icon: FileEdit
        };
    }
  };

  const getAdministrationFeeStatus = (): boolean => {
    const adminFeeRecord = paymentRecords.find(r => r.payment_type === 'administration_fee');
    return adminFeeRecord ? (adminFeeRecord.payment_status === 'paid' || adminFeeRecord.payment_status === 'waived') : false;
  };

  const getExamStatus = () => {
    if (examResults.length === 0) {
      return {
        status: 'not_attempted' as const,
        label: 'Belum mengikuti ujian',
        color: 'bg-slate-300',
        icon: Clock,
        examTitle: null,
        percentage: null,
        attemptNumber: null,
        submittedAt: null
      };
    }

    const latestResult = examResults[0];
    const isGraded = latestResult.grading_status === 'completed' && latestResult.passed !== null;

    if (!isGraded) {
      return {
        status: 'pending_grading' as const,
        label: 'Menunggu penilaian',
        color: 'bg-amber-600',
        icon: Clock,
        examTitle: latestResult.attempt.exam.title,
        percentage: null,
        attemptNumber: latestResult.attempt.attempt_number,
        submittedAt: latestResult.attempt.submitted_at
      };
    }

    if (latestResult.passed) {
      return {
        status: 'passed' as const,
        label: 'Lulus',
        color: 'bg-emerald-600',
        icon: CheckCircle,
        examTitle: latestResult.attempt.exam.title,
        percentage: latestResult.percentage,
        attemptNumber: latestResult.attempt.attempt_number,
        submittedAt: latestResult.attempt.submitted_at
      };
    }

    return {
      status: 'failed' as const,
      label: 'Tidak lulus',
      color: 'bg-red-600',
      icon: XCircle,
      examTitle: latestResult.attempt.exam.title,
      percentage: latestResult.percentage,
      attemptNumber: latestResult.attempt.attempt_number,
      submittedAt: latestResult.attempt.submitted_at
    };
  };

  const isAllStepsCompleted = (): boolean => {
    if (!application) return false;

    const formSubmitted = application.status !== 'draft';
    const adminApproved = application.status === 'approved';
    const examPassed = examResults.some(r => r.grading_status === 'completed' && r.passed === true);
    const adminFeePaid = getAdministrationFeeStatus();
    const hasGeneratedDocuments = totalGenerated > 0;

    console.log('[StudentDashboard] isAllStepsCompleted check:', {
      formSubmitted,
      adminApproved,
      examPassed,
      adminFeePaid,
      hasGeneratedDocuments,
      allCompleted: formSubmitted && adminApproved && examPassed && adminFeePaid && hasGeneratedDocuments
    });

    return formSubmitted && adminApproved && examPassed && adminFeePaid && hasGeneratedDocuments;
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

  const statusInfo = getStatusInfo();
  const completeness = calculateCompleteness();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Siswa</h2>
        <p className="text-slate-600 mt-1">Selamat datang di portal pendaftaran SPMB</p>
      </div>

      {(!application || application.status === 'draft') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                {!application ? 'Lengkapi Data Pendaftaran' : 'Draft Belum Disubmit'}
              </h3>
              <p className="text-blue-700 text-sm mb-4">
                {!application
                  ? 'Silakan lengkapi formulir pendaftaran untuk melanjutkan proses SPMB.'
                  : 'Anda memiliki draft yang belum disubmit. Lengkapi dan submit formulir untuk diproses admin.'}
              </p>
              <Link
                to="/student/application"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <FileEdit className="h-4 w-4" />
                {!application ? 'Isi Formulir' : 'Lanjutkan Isi Formulir'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {application && isAllStepsCompleted() && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900 mb-1">Selamat! Anda Diterima</h3>
              <p className="text-emerald-700 text-sm mb-4">
                Semua tahapan pendaftaran telah diselesaikan. Anda resmi diterima sebagai siswa baru. Silakan cek email untuk informasi lebih lanjut.
              </p>
            </div>
          </div>
        </div>
      )}

      {application && application.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Pendaftaran Ditolak</h3>
              <p className="text-red-700 text-sm">
                Mohon maaf, pendaftaran Anda tidak dapat diproses. Silakan hubungi admin untuk informasi lebih lanjut.
              </p>
            </div>
          </div>
        </div>
      )}

      {application && application.admin_comments && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-2">Catatan dari Admin</h3>
              <p className="text-amber-800 text-sm whitespace-pre-wrap leading-relaxed">
                {application.admin_comments}
              </p>
              {application.commented_at && (
                <p className="text-xs text-amber-700 mt-3">
                  Diperbarui: {new Date(application.commented_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {interviewRequest && (
        <div className={`rounded-xl border p-6 ${interviewRequest.status === 'approved' ? 'bg-emerald-50 border-emerald-200' :
          interviewRequest.status === 'revision_requested' ? 'bg-blue-50 border-blue-200' :
            'bg-amber-50 border-amber-200'
          }`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${interviewRequest.status === 'approved' ? 'bg-emerald-600' :
                interviewRequest.status === 'revision_requested' ? 'bg-blue-600' :
                  'bg-amber-600'
                }`}>
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold mb-2 ${interviewRequest.status === 'approved' ? 'text-emerald-900' :
                  interviewRequest.status === 'revision_requested' ? 'text-blue-900' :
                    'text-amber-900'
                  }`}>
                  {interviewRequest.status === 'approved' && 'Jadwal Interview Disetujui'}
                  {interviewRequest.status === 'revision_requested' && 'Permintaan Interview Perlu Revisi'}
                  {interviewRequest.status === 'pending_review' && 'Menunggu Review Interview'}
                </h3>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">{format(new Date(interviewRequest.proposed_date), 'EEEE, dd MMMM yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>{interviewRequest.proposed_time_start.substring(0, 5)} - {interviewRequest.proposed_time_end.substring(0, 5)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {interviewRequest.proposed_type === 'online' ? (
                      <><Video className="h-4 w-4" /><span>Online</span></>
                    ) : (
                      <><MapPin className="h-4 w-4" /><span>Offline di Sekolah</span></>
                    )}
                  </div>
                </div>

                {interviewRequest.status === 'approved' && interviewRequest.meeting_link && (
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <p className="text-xs font-medium text-emerald-800 mb-1">Link Meeting:</p>
                    <a
                      href={interviewRequest.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 underline break-all"
                    >
                      {interviewRequest.meeting_link}
                    </a>
                  </div>
                )}

                {interviewRequest.admin_notes && (
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <p className="text-xs font-medium mb-1">Catatan Admin:</p>
                    <p className="text-sm">{interviewRequest.admin_notes}</p>
                  </div>
                )}

                {interviewRequest.status === 'revision_requested' && interviewRequest.revision_requested_notes && (
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <p className="text-xs font-medium text-blue-800 mb-1">Perlu Revisi:</p>
                    <p className="text-sm text-blue-700">{interviewRequest.revision_requested_notes}</p>
                  </div>
                )}

                <Link
                  to="/student/interview-booking"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${interviewRequest.status === 'revision_requested'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white hover:bg-slate-50'
                    }`}
                >
                  {interviewRequest.status === 'revision_requested' ? (
                    <><Edit2 className="h-4 w-4" />Edit Permintaan</>
                  ) : (
                    <>Lihat Detail</>
                  )}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${statusInfo.color}`}>
              <StatusIcon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-slate-800">Status Pendaftaran</h3>
          </div>
          {application ? (
            <StatusBadge status={application.status} size="md" />
          ) : (
            <p className="text-lg font-semibold text-slate-600">Belum Mendaftar</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center">
              <FileEdit className="h-5 w-5 text-slate-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Kelengkapan Data</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-800">{completeness}%</p>
            <p className="text-sm text-slate-600">lengkap</p>
          </div>
          <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-500"
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-slate-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Tanggal Daftar</h3>
          </div>
          {application ? (
            <>
              <p className="text-lg font-semibold text-slate-800">
                {new Date(application.created_at).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                {new Date(application.created_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </>
          ) : (
            <p className="text-slate-600">Belum mendaftar</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Langkah-Langkah Pendaftaran</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${application ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}>
              {application ? '✓' : '1'}
            </div>
            <div>
              <h4 className="font-medium text-slate-800">Lengkapi Formulir Pendaftaran</h4>
              <p className="text-sm text-slate-600 mt-1">Isi data diri dan informasi pendaftaran dengan lengkap dan benar.</p>
              {application && application.status === 'draft' && (
                <Link
                  to="/student/application"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block"
                >
                  Lanjutkan mengisi →
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${application && application.status !== 'draft' ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-white'
              }`}>
              {application && application.status !== 'draft' ? '✓' : '2'}
            </div>
            <div>
              <h4 className="font-medium text-slate-800">Submit Pendaftaran</h4>
              <p className="text-sm text-slate-600 mt-1">Submit formulir untuk diverifikasi oleh admin.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${application && ['approved', 'rejected'].includes(application.status) ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-white'
              }`}>
              {application && ['approved', 'rejected'].includes(application.status) ? '✓' : '3'}
            </div>
            <div>
              <h4 className="font-medium text-slate-800">Tunggu Hasil Verifikasi</h4>
              <p className="text-sm text-slate-600 mt-1">Admin akan memverifikasi data Anda dan memberikan keputusan.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${interviewRequest && interviewRequest.status === 'completed' ? 'bg-emerald-600 text-white' :
              interviewRequest && interviewRequest.status === 'approved' ? 'bg-blue-600 text-white' :
                interviewRequest ? 'bg-amber-600 text-white' : 'bg-slate-300 text-white'
              }`}>
              {interviewRequest && interviewRequest.status === 'completed' ? '✓' : '4'}
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-slate-800">Jadwalkan dan Ikuti Interview</h4>
              {!interviewRequest && (
                <>
                  <p className="text-sm text-slate-600 mt-1">
                    Ajukan permintaan jadwal interview dengan admin.
                  </p>
                  <Link
                    to="/student/interview-booking"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Ajukan Interview →
                  </Link>
                </>
              )}
              {interviewRequest && interviewRequest.status === 'pending_review' && (
                <>
                  <p className="text-sm text-slate-600 mt-1">
                    Permintaan interview Anda sedang ditinjau oleh admin.
                  </p>
                  <div className="mt-2 text-xs text-slate-500">
                    <div>Tanggal: {format(new Date(interviewRequest.proposed_date), 'dd MMM yyyy')}</div>
                    <div>Waktu: {interviewRequest.proposed_time_start.substring(0, 5)} - {interviewRequest.proposed_time_end.substring(0, 5)}</div>
                  </div>
                </>
              )}
              {interviewRequest && interviewRequest.status === 'revision_requested' && (
                <>
                  <p className="text-sm text-slate-600 mt-1">
                    Permintaan interview perlu direvisi.
                  </p>
                  <Link
                    to="/student/interview-booking"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Permintaan →
                  </Link>
                </>
              )}
              {interviewRequest && interviewRequest.status === 'approved' && (
                <>
                  <p className="text-sm text-slate-600 mt-1">
                    Interview telah dijadwalkan. Jangan lupa hadir sesuai waktu yang ditentukan.
                  </p>
                  <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-xs text-emerald-800">
                      <div className="font-semibold mb-1">Jadwal Interview</div>
                      <div>Tanggal: {format(new Date(interviewRequest.proposed_date), 'dd MMM yyyy')}</div>
                      <div>Waktu: {interviewRequest.proposed_time_start.substring(0, 5)} - {interviewRequest.proposed_time_end.substring(0, 5)}</div>
                      <div>Tipe: {interviewRequest.proposed_type === 'online' ? 'Online' : 'Offline'}</div>
                    </div>
                  </div>
                  <Link
                    to="/student/interview-booking"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                  >
                    Lihat Detail →
                  </Link>
                </>
              )}
              {interviewRequest && interviewRequest.status === 'completed' && (
                <>
                  <p className="text-sm text-slate-600 mt-1">
                    Interview telah selesai dilaksanakan.
                  </p>
                  <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-xs text-emerald-800">
                      <div className="font-semibold mb-1">Interview Selesai</div>
                      <div>Tanggal: {format(new Date(interviewRequest.proposed_date), 'dd MMM yyyy')}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4">
            {(() => {
              const examStatus = getExamStatus();

              return (
                <>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${examStatus.status === 'passed' ? 'bg-emerald-600 text-white' :
                    examStatus.status === 'pending_grading' ? 'bg-amber-600 text-white' :
                      examStatus.status === 'failed' ? 'bg-red-600 text-white' : 'bg-slate-300 text-white'
                    }`}>
                    {examStatus.status === 'passed' ? '✓' : '5'}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-800">Ikuti dan Lulus Ujian</h4>

                    {examStatus.status === 'not_attempted' && (
                      <>
                        <p className="text-sm text-slate-600 mt-1">
                          Ikuti ujian untuk melanjutkan proses pendaftaran.
                        </p>
                        <Link
                          to="/student/exam-portal"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                        >
                          Mulai Ujian →
                        </Link>
                      </>
                    )}

                    {examStatus.status === 'pending_grading' && (
                      <>
                        <p className="text-sm text-slate-600 mt-1">
                          Hasil ujian sedang dinilai oleh admin. Silakan tunggu.
                        </p>
                        <div className="mt-2 text-xs text-slate-500">
                          <div>Ujian: {examStatus.examTitle}</div>
                          <div>Disubmit: {examStatus.submittedAt ? format(new Date(examStatus.submittedAt), 'dd MMM yyyy, HH:mm') : '-'}</div>
                        </div>
                      </>
                    )}

                    {examStatus.status === 'passed' && (
                      <>
                        <p className="text-sm text-slate-600 mt-1">
                          Selamat! Anda telah lulus ujian.
                        </p>
                        <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <div className="text-xs text-emerald-800">
                            <div className="font-semibold mb-1">{examStatus.examTitle}</div>
                            <div>Nilai: {examStatus.percentage}%</div>
                            <div>Tanggal: {examStatus.submittedAt ? format(new Date(examStatus.submittedAt), 'dd MMM yyyy') : '-'}</div>
                          </div>
                        </div>
                      </>
                    )}

                    {examStatus.status === 'failed' && (
                      <>
                        <p className="text-sm text-slate-600 mt-1">
                          Anda belum lulus ujian. Jangan menyerah, Anda dapat mencoba lagi.
                        </p>
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                          <div className="text-xs text-red-800">
                            <div className="font-semibold mb-1">{examStatus.examTitle}</div>
                            <div>Nilai: {examStatus.percentage}%</div>
                            <div>Percobaan #{examStatus.attemptNumber}</div>
                          </div>
                        </div>
                        <Link
                          to="/student/exam-portal"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Coba Lagi →
                        </Link>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="flex items-start gap-4">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${getAdministrationFeeStatus()
              ? 'bg-emerald-600 text-white'
              : paymentRecords.some(r => r.payment_type === 'administration_fee')
                ? 'bg-blue-600 text-white'
                : 'bg-slate-300 text-white'
              }`}>
              {getAdministrationFeeStatus() ? '✓' : '6'}
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-slate-800">Pembayaran Biaya Administrasi</h4>
              <p className="text-sm text-slate-600 mt-1">
                {!paymentRecords.some(r => r.payment_type === 'administration_fee')
                  ? 'Menunggu admin untuk setup biaya administrasi Anda.'
                  : getAdministrationFeeStatus()
                    ? 'Biaya administrasi telah lunas.'
                    : 'Biaya administrasi harus dibayar untuk menyelesaikan pendaftaran.'}
              </p>
              {paymentRecords.some(r => r.payment_type === 'administration_fee') && !getAdministrationFeeStatus() && (
                <p className="text-xs text-slate-500 mt-2">
                  💡 Catatan: Biaya masuk dapat dibayar bertahap setelah diterima.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${totalGenerated === 0 ? 'bg-slate-300 text-white' :
              totalDownloaded === totalGenerated ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}>
              {totalGenerated > 0 && totalDownloaded === totalGenerated ? '✓' : '7'}
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-slate-800">Generate Dokumen</h4>
              <p className="text-sm text-slate-600 mt-1">
                {totalGenerated === 0
                  ? 'Generate dan unduh dokumen resmi Anda seperti surat penerimaan, konfirmasi, dan lainnya setelah pendaftaran diproses.'
                  : totalDownloaded === totalGenerated
                    ? `Semua dokumen (${totalGenerated}) sudah diunduh.`
                    : `Unduh dokumen yang sudah di-generate. Progress: ${totalDownloaded} dari ${totalGenerated} dokumen sudah diunduh.`}
              </p>
              {totalGenerated > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-700">
                      {totalDownloaded}/{totalGenerated} dokumen
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {Math.round((totalDownloaded / totalGenerated) * 100)}%
                    </span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${totalDownloaded === totalGenerated ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                      style={{ width: `${Math.round((totalDownloaded / totalGenerated) * 100)}%` }}
                    />
                  </div>
                  {totalDownloaded < totalGenerated && (
                    <Link
                      to="/student/generate"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-3"
                    >
                      <Download className="h-4 w-4" />
                      Lihat & Generate Dokumen
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {application && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Riwayat Pendaftaran</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Dibuat</span>
              <span className="text-sm font-medium text-slate-800">
                {new Date(application.created_at).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Terakhir Diupdate</span>
              <span className="text-sm font-medium text-slate-800">
                {new Date(application.updated_at).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600">ID Pendaftaran</span>
              <span className="text-sm font-mono text-slate-800">
                {application.registration_number || `${application.id.slice(0, 8)}...`}
              </span>
            </div>
          </div>
        </div>
      )}

      {paymentRecords.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-800">Informasi Pembayaran</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-900 uppercase">Biaya Administrasi (WAJIB)</span>
              </div>
              <p className="text-xs text-emerald-800">
                Harus dibayar lunas untuk menyelesaikan pendaftaran dan diterima sebagai siswa baru.
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-900 uppercase">Biaya Masuk (OPSIONAL)</span>
              </div>
              <p className="text-xs text-blue-800">
                Dapat dibayar secara bertahap setelah Anda diterima sebagai siswa baru.
              </p>
            </div>
          </div>

          <PaymentSummaryCard paymentRecords={paymentRecords} batchName={batchName || undefined} />

          <div className="space-y-6 mt-6">
            {paymentRecords.find(r => r.payment_type === 'administration_fee') && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 px-3 bg-emerald-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    WAJIB
                  </div>
                  <h4 className="font-semibold text-slate-800">Biaya Administrasi</h4>
                </div>
                <PaymentInfoCard paymentRecord={paymentRecords.find(r => r.payment_type === 'administration_fee')!} />
              </div>
            )}

            {paymentRecords.find(r => r.payment_type === 'entrance_fee') && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 px-3 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    DAPAT DICICIL
                  </div>
                  <h4 className="font-semibold text-slate-800">Biaya Masuk</h4>
                </div>
                <PaymentInfoCard paymentRecord={paymentRecords.find(r => r.payment_type === 'entrance_fee')!} />
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Catatan:</strong> Status pembayaran Anda dikelola oleh admin.
              Jika Anda telah melakukan pembayaran, silakan hubungi admin untuk konfirmasi dan update status pembayaran Anda.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
