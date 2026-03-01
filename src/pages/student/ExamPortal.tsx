import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Play, Ticket, Loader, Shield, Trophy } from 'lucide-react';
import { ExamTaking } from '../../components/student/ExamTaking';
import { ExamResults } from '../../components/student/ExamResults';

interface Exam {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
  max_attempts: number;
  status: string;
}

interface Attempt {
  id: string;
  exam_id: string;
  attempt_number: number;
  status: string;
  started_at: string;
  submitted_at: string | null;
}

interface ExamResult {
  percentage: number;
  passed: boolean | null;
  grading_status: string;
}

export const ExamPortal: React.FC = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [results, setResults] = useState<Record<string, ExamResult>>({});
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenCode, setTokenCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [tokenResult, setTokenResult] = useState<{
    success: boolean;
    message: string;
    examTitle?: string;
  } | null>(null);
  const [takingExam, setTakingExam] = useState<{ examId: string; examTitle: string; tokenId: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'exams' | 'results'>('exams');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: applicantData } = await supabase
        .from('applicants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!applicantData) {
        setLoading(false);
        return;
      }

      setApplicantId(applicantData.id);

      console.log('[ExamPortal] Fetching token-activated exam IDs for applicant:', applicantData.id);
      const { data: activatedIds, error: rpcError } = await supabase.rpc('get_activated_exam_ids', {
        p_applicant_id: applicantData.id
      });

      if (rpcError) {
        console.error('[ExamPortal] Error fetching activated exam IDs:', rpcError);
      }

      const activatedExamIds: string[] = activatedIds || [];
      console.log('[ExamPortal] Activated exam IDs:', activatedExamIds);

      if (activatedExamIds.length === 0) {
        console.log('[ExamPortal] No activated exams found');
        setExams([]);
        setAttempts({});
        setResults({});
        setLoading(false);
        return;
      }

      const { data: examsData } = await supabase
        .from('exams')
        .select('*')
        .eq('status', 'published')
        .in('id', activatedExamIds)
        .order('created_at', { ascending: false });

      if (examsData) {
        console.log('[ExamPortal] Loaded', examsData.length, 'token-activated exams');
        setExams(examsData);

        const { data: attemptsData } = await supabase
          .from('exam_attempts')
          .select('*')
          .eq('applicant_id', applicantData.id)
          .in('exam_id', examsData.map(e => e.id));

        if (attemptsData) {
          const attemptsByExam: Record<string, Attempt[]> = {};
          for (const attempt of attemptsData) {
            if (!attemptsByExam[attempt.exam_id]) {
              attemptsByExam[attempt.exam_id] = [];
            }
            attemptsByExam[attempt.exam_id].push(attempt);
          }
          setAttempts(attemptsByExam);

          const completedAttempts = attemptsData.filter(a => a.status === 'completed');
          if (completedAttempts.length > 0) {
            const { data: resultsData } = await supabase
              .from('exam_results')
              .select('attempt_id, percentage, passed, grading_status')
              .in('attempt_id', completedAttempts.map(a => a.id));

            if (resultsData) {
              const resultsMap: Record<string, ExamResult> = {};
              for (const result of resultsData) {
                resultsMap[result.attempt_id] = result;
              }
              setResults(resultsMap);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemToken = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!applicantId) {
      setTokenResult({
        success: false,
        message: 'Anda harus melengkapi form pendaftaran terlebih dahulu'
      });
      return;
    }

    const cleanedToken = tokenCode.trim().toUpperCase();
    if (!cleanedToken) {
      setTokenResult({
        success: false,
        message: 'Mohon masukkan kode token'
      });
      return;
    }

    if (cleanedToken.length !== 5) {
      setTokenResult({
        success: false,
        message: 'Kode token harus 5 karakter'
      });
      return;
    }

    setRedeeming(true);
    setTokenResult(null);

    try {
      const { data, error } = await supabase.rpc('redeem_exam_token', {
        p_token_code: cleanedToken,
        p_applicant_id: applicantId,
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
        p_device_fingerprint: null
      });

      if (error) throw error;

      if (data.success) {
        const { data: examData } = await supabase
          .from('exams')
          .select('title')
          .eq('id', data.exam_id)
          .single();

        setTokenResult({
          success: true,
          message: 'Token berhasil diaktifkan! Ujian tersedia di bawah.',
          examTitle: examData?.title || 'Ujian'
        });
        setTokenCode('');

        await fetchData();
      } else {
        setTokenResult({
          success: false,
          message: data.error || 'Gagal mengaktifkan token'
        });
      }
    } catch (error: any) {
      console.error('Error redeeming token:', error);
      setTokenResult({
        success: false,
        message: error.message || 'Terjadi kesalahan saat mengaktifkan token'
      });
    } finally {
      setRedeeming(false);
    }
  };

  const handleStartExam = async (examId: string) => {
    if (!applicantId) {
      alert('Anda harus melengkapi form pendaftaran terlebih dahulu');
      return;
    }

    const exam = exams.find(e => e.id === examId);
    if (!exam) return;

    try {
      console.log('Checking token access for exam:', examId);

      const { data: tokenCheck, error: tokenError } = await supabase.rpc('check_exam_token_access', {
        p_exam_id: examId,
        p_applicant_id: applicantId
      });

      console.log('Token check result:', tokenCheck);

      if (tokenError) {
        console.error('Token check error:', tokenError);
        alert('Gagal memeriksa akses token. Silakan coba lagi.');
        return;
      }

      if (!tokenCheck.has_access) {
        alert(tokenCheck.error || 'Anda belum memiliki akses untuk ujian ini. Silakan aktifkan token terlebih dahulu.');
        return;
      }

      console.log('Token access granted. Starting exam...');
      setTakingExam({
        examId: exam.id,
        examTitle: exam.title,
        tokenId: tokenCheck.token_id
      });
    } catch (error) {
      console.error('Error checking token access:', error);
      alert('Terjadi kesalahan saat memeriksa akses ujian');
    }
  };

  const getExamStatus = (examId: string) => {
    const examAttempts = attempts[examId] || [];

    if (examAttempts.length === 0) {
      return { label: 'Belum Dikerjakan', color: 'bg-slate-100 text-slate-700', icon: FileText };
    }

    const completed = examAttempts.filter(a => a.status === 'completed');
    if (completed.length === 0) {
      const inProgress = examAttempts.find(a => a.status === 'in_progress');
      if (inProgress) {
        return { label: 'Sedang Dikerjakan', color: 'bg-blue-100 text-blue-700', icon: Clock };
      }
    }

    const lastCompleted = completed[completed.length - 1];
    if (lastCompleted) {
      const result = results[lastCompleted.id];
      if (result) {
        if (result.grading_status !== 'completed' || result.passed === null || result.passed === undefined) {
          return { label: 'Menunggu Penilaian', color: 'bg-amber-100 text-amber-700', icon: Clock };
        }
        if (result.passed) {
          return { label: 'Lulus', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle };
        } else {
          return { label: 'Tidak Lulus', color: 'bg-red-100 text-red-700', icon: XCircle };
        }
      }
    }

    return { label: 'Selesai', color: 'bg-blue-100 text-blue-700', icon: CheckCircle };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!applicantId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Lengkapi Form Pendaftaran</h3>
            <p className="text-amber-700 text-sm">
              Anda harus melengkapi form pendaftaran terlebih dahulu sebelum bisa mengakses ujian.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (takingExam && applicantId) {
    return (
      <ExamTaking
        examId={takingExam.examId}
        applicantId={applicantId}
        tokenId={takingExam.tokenId}
        onComplete={() => {
          setTakingExam(null);
          fetchData();
        }}
        onCancel={() => {
          setTakingExam(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Portal Ujian</h2>
        <p className="text-slate-600 mt-1">Aktivasi token, ikuti ujian, dan lihat hasil Anda</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('exams')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'exams'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span>Ujian Tersedia</span>
          </div>
          {activeTab === 'exams' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'results'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            <span>Hasil Ujian</span>
          </div>
          {activeTab === 'results' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
      </div>

      {activeTab === 'exams' ? (
        <>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Ticket className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Aktivasi Token Ujian</h3>
            <p className="text-sm text-slate-600">
              Masukkan kode token 5 karakter untuk mengakses ujian
            </p>
          </div>
        </div>

        <form onSubmit={handleRedeemToken} className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={tokenCode}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (value.length <= 5) {
                  setTokenCode(value);
                }
              }}
              placeholder="AB12C"
              maxLength={5}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-mono text-xl tracking-widest bg-white"
              disabled={redeeming}
            />
            <button
              type="submit"
              disabled={redeeming || tokenCode.length !== 5}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              {redeeming ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  Validasi...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Aktifkan
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Format: 5 karakter huruf dan angka (contoh: AB12C, XY9Z3)
          </p>
        </form>

        {tokenResult && (
          <div
            className={`mt-4 p-4 rounded-lg border ${
              tokenResult.success
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {tokenResult.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`font-medium ${
                    tokenResult.success ? 'text-emerald-900' : 'text-red-900'
                  }`}
                >
                  {tokenResult.success ? 'Berhasil!' : 'Gagal'}
                </p>
                <p
                  className={`text-sm mt-1 ${
                    tokenResult.success ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {tokenResult.message}
                </p>
                {tokenResult.success && tokenResult.examTitle && (
                  <p className="text-sm text-emerald-700 mt-1">
                    Ujian: <span className="font-semibold">{tokenResult.examTitle}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Cara Menggunakan:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Dapatkan kode token 5 karakter dari admin</li>
              <li>Masukkan kode di form di atas dan klik "Aktifkan"</li>
              <li>Jika berhasil, ujian akan muncul di daftar di bawah</li>
              <li>Klik "Mulai Ujian" untuk mengikuti ujian</li>
            </ol>
          </div>
        </div>
      </div>

          <div>
            {exams.length > 0 && (
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Ujian Tersedia</h3>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((exam) => {
          const examAttempts = attempts[exam.id] || [];
          const status = getExamStatus(exam.id);
          const StatusIcon = status.icon;
          const canTakeExam = examAttempts.length < exam.max_attempts;

          return (
            <div key={exam.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-800">{exam.title}</h3>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${status.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </span>
              </div>

              {exam.description && (
                <p className="text-sm text-slate-600 mb-4">{exam.description}</p>
              )}

              <div className="space-y-2 text-sm text-slate-600 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Durasi: {exam.duration_minutes} menit</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Passing Score: {exam.passing_score}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Percobaan: {examAttempts.length} / {exam.max_attempts}</span>
                </div>
              </div>

              {canTakeExam ? (
                <button
                  onClick={() => handleStartExam(exam.id)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  {examAttempts.length > 0 ? 'Coba Lagi' : 'Mulai Ujian'}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full px-4 py-2 bg-slate-300 text-slate-600 rounded-lg cursor-not-allowed"
                >
                  Batas Percobaan Tercapai
                </button>
              )}
            </div>
          );
        })}
              {exams.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-xl col-span-full">
                  <Ticket className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">Belum ada ujian yang diaktifkan</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Masukkan kode token 5 karakter di form di atas untuk membuka akses ujian
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <ExamResults applicantId={applicantId!} />
      )}
    </div>
  );
};
