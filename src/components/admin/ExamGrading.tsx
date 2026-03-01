import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, User, Clock, CheckCircle, XCircle, Save, Eye, AlertCircle, Award, Key, ThumbsUp, ThumbsDown, ShieldAlert, Download } from 'lucide-react';
import { format } from 'date-fns';
import { generateAdminExamReport, ExamReportData } from '../../lib/examReportGenerator';
import { sendExamGradedNotification } from '../../lib/examNotifications';
import { RichContentRenderer, RichContentStyles } from '../shared/RichContentRenderer';

interface Attempt {
  id: string;
  exam_id: string;
  applicant_id: string;
  attempt_number: number;
  status: string;
  started_at: string;
  submitted_at: string;
  applicant: {
    dynamic_data: any;
    user_id: string;
    registration_number?: string;
  };
  exam: {
    title: string;
  };
}

interface Result {
  id: string;
  attempt_id: string;
  total_points: number;
  max_points: number;
  percentage: number;
  passed: boolean | null;
  auto_graded_points: number;
  manual_graded_points: number;
  grading_status: 'pending' | 'partial' | 'completed';
}

interface ExamGradingProps {
  examId?: string;
}

export const ExamGrading: React.FC<ExamGradingProps> = ({ examId }) => {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [violationCounts, setViolationCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null);

  useEffect(() => {
    fetchAttempts();
  }, [examId]);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      console.log('[ExamGrading] Fetching attempts for examId:', examId);

      let query = supabase
        .from('exam_attempts')
        .select(`
          *,
          applicant:applicants!inner(
            dynamic_data,
            user_id,
            registration_number
          ),
          exam:exams!inner(title)
        `)
        .eq('status', 'completed')
        .order('submitted_at', { ascending: false });

      if (examId) {
        query = query.eq('exam_id', examId);
      }

      const { data: attemptsData, error: attemptsError } = await query;

      if (attemptsError) throw attemptsError;
      console.log('[ExamGrading] Fetched attempts:', attemptsData?.length);

      if (attemptsData && attemptsData.length > 0) {
        setAttempts(attemptsData);

        const { data: resultsData, error: resultsError } = await supabase
          .from('exam_results')
          .select('*')
          .in('attempt_id', attemptsData.map(a => a.id));

        if (resultsError) throw resultsError;

        const resultsMap: Record<string, Result> = {};
        if (resultsData) {
          for (const result of resultsData) {
            resultsMap[result.attempt_id] = result;
          }
        }
        setResults(resultsMap);

        const { data: logsData } = await supabase
          .from('exam_proctoring_logs')
          .select('attempt_id')
          .in('attempt_id', attemptsData.map(a => a.id));

        if (logsData) {
          const counts: Record<string, number> = {};
          for (const log of logsData) {
            counts[log.attempt_id] = (counts[log.attempt_id] || 0) + 1;
          }
          setViolationCounts(counts);
          console.log('[ExamGrading] Violation counts:', counts);
        }
      } else {
        setAttempts([]);
        setResults({});
      }
    } catch (error) {
      console.error('[ExamGrading] Error fetching attempts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Selesai</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Pending</span>;
      case 'partial':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Sebagian</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  const getViolationBadge = (attemptId: string) => {
    const count = violationCounts[attemptId] || 0;
    if (count === 0) {
      return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">0</span>;
    }
    if (count <= 3) {
      return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{count}</span>;
    }
    return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">{count}</span>;
  };

  const filteredAttempts = filterStatus === 'all'
    ? attempts
    : attempts.filter(a => {
        const result = results[a.id];
        if (!result) return false;
        return result.grading_status === filterStatus;
      });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (selectedAttempt) {
    return (
      <GradingDetail
        attemptId={selectedAttempt}
        onBack={() => {
          setSelectedAttempt(null);
          fetchAttempts();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Penilaian Ujian</h2>
          <p className="text-slate-600 mt-1">Nilai jawaban siswa dan review hasil ujian</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { value: 'all', label: 'Semua' },
          { value: 'pending', label: 'Pending' },
          { value: 'partial', label: 'Sebagian' },
          { value: 'completed', label: 'Selesai' }
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilterStatus(value)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
            <span className="ml-2 font-semibold">
              ({value === 'all'
                ? attempts.length
                : attempts.filter(a => results[a.id]?.grading_status === value).length
              })
            </span>
          </button>
        ))}
      </div>

      {filteredAttempts.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Belum ada ujian yang perlu dinilai</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Siswa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Ujian
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Waktu Submit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Nilai
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Pelanggaran
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAttempts.map((attempt) => {
                const result = results[attempt.id];

                return (
                  <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            {attempt.applicant.dynamic_data?.nama_lengkap || 'Nama tidak tersedia'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {attempt.applicant.registration_number || 'No. Registrasi tidak tersedia'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800">{attempt.exam.title}</p>
                      <p className="text-sm text-slate-500">Percobaan #{attempt.attempt_number}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">
                          {format(new Date(attempt.submitted_at), 'dd MMM yyyy HH:mm')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {result ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-slate-800">
                              {result.percentage.toFixed(1)}%
                            </span>
                            {result.passed === true && (
                              <CheckCircle className="h-5 w-5 text-emerald-600" />
                            )}
                            {result.passed === false && (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {result.total_points.toFixed(1)} / {result.max_points.toFixed(1)} poin
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getViolationBadge(attempt.id)}
                    </td>
                    <td className="px-6 py-4">
                      {result ? getStatusBadge(result.grading_status) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedAttempt(attempt.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 ml-auto"
                      >
                        <Eye className="h-4 w-4" />
                        {result?.grading_status === 'pending' || result?.grading_status === 'partial'
                          ? 'Nilai'
                          : 'Detail'
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface GradingDetailProps {
  attemptId: string;
  onBack: () => void;
}

interface AnswerGrade {
  points: number;
  feedback?: string;
}

const GradingDetail: React.FC<GradingDetailProps> = ({ attemptId, onBack }) => {
  const [attempt, setAttempt] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [allOptions, setAllOptions] = useState<Record<string, any[]>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grades, setGrades] = useState<Record<string, AnswerGrade>>({});
  const [passDecision, setPassDecision] = useState<boolean | null>(null);
  const [proctoringLogs, setProctoringLogs] = useState<any[]>([]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    loadAttemptDetail();
  }, [attemptId]);

  const loadAttemptDetail = async () => {
    try {
      setLoading(true);
      console.log('[GradingDetail] Loading attempt:', attemptId);

      const { data: attemptData, error: attemptError } = await supabase
        .from('exam_attempts')
        .select(`
          *,
          applicant:applicants!inner(
            dynamic_data,
            user_id,
            registration_number
          ),
          exam:exams!inner(title, passing_score)
        `)
        .eq('id', attemptId)
        .single();

      if (attemptError) throw attemptError;
      setAttempt(attemptData);

      const { data: answersData, error: answersError } = await supabase
        .from('exam_answers')
        .select(`
          *,
          question:exam_questions!inner(*),
          selected_option:exam_question_options(*)
        `)
        .eq('attempt_id', attemptId);

      if (answersError) throw answersError;
      console.log('[GradingDetail] Loaded answers:', answersData?.length);
      setAnswers(answersData || []);

      const questionIds = answersData?.map(a => a.question.id) || [];
      if (questionIds.length > 0) {
        const { data: optionsData } = await supabase
          .from('exam_question_options')
          .select('*')
          .in('question_id', questionIds)
          .order('order_index', { ascending: true });

        if (optionsData) {
          const optsByQ: Record<string, any[]> = {};
          for (const opt of optionsData) {
            if (!optsByQ[opt.question_id]) optsByQ[opt.question_id] = [];
            optsByQ[opt.question_id].push(opt);
          }
          setAllOptions(optsByQ);
          console.log('[GradingDetail] Loaded options for', Object.keys(optsByQ).length, 'questions');
        }
      }

      const { data: resultData, error: resultError } = await supabase
        .from('exam_results')
        .select('*')
        .eq('attempt_id', attemptId)
        .maybeSingle();

      if (resultError) throw resultError;
      setResult(resultData);
      setPassDecision(resultData?.passed ?? null);

      const initialGrades: Record<string, AnswerGrade> = {};
      if (answersData) {
        for (const answer of answersData) {
          initialGrades[answer.id] = {
            points: answer.points_earned ?? 0,
            feedback: ''
          };
        }
      }
      setGrades(initialGrades);
      console.log('[GradingDetail] Initialized grades for', Object.keys(initialGrades).length, 'answers');

      const { data: logsData } = await supabase
        .from('exam_proctoring_logs')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('timestamp', { ascending: true });

      setProctoringLogs(logsData || []);
      console.log('[GradingDetail] Loaded proctoring logs:', logsData?.length);
    } catch (error) {
      console.error('[GradingDetail] Error loading attempt detail:', error);
      alert('Gagal memuat detail ujian');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (answerId: string, points: number) => {
    setGrades(prev => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        points
      }
    }));
  };

  const handleApplyAnswerKey = () => {
    console.log('[GradingDetail] Applying answer key to MC/TF questions');
    let appliedCount = 0;

    const newGrades = { ...grades };
    for (const answer of answers) {
      const qType = answer.question.question_type;
      if (qType === 'multiple_choice' || qType === 'true_false') {
        const correctOption = allOptions[answer.question.id]?.find((o: any) => o.is_correct);
        const isCorrect = answer.selected_option_id && correctOption && answer.selected_option_id === correctOption.id;
        newGrades[answer.id] = {
          ...newGrades[answer.id],
          points: isCorrect ? answer.question.points : 0
        };
        appliedCount++;
      }
    }

    setGrades(newGrades);
    console.log('[GradingDetail] Applied answer key to', appliedCount, 'questions');
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    console.log('[GradingDetail] Saving grades for attempt:', attemptId);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let savedCount = 0;
      for (const [answerId, grade] of Object.entries(grades)) {
        const { error } = await supabase
          .from('exam_answers')
          .update({
            points_earned: grade.points,
            is_correct: grade.points > 0
          })
          .eq('id', answerId);

        if (error) {
          console.error('[GradingDetail] Error saving answer grade:', answerId, error);
          throw error;
        }
        savedCount++;
      }
      console.log('[GradingDetail] Saved', savedCount, 'answer grades');

      console.log('[GradingDetail] Calling calculate_exam_result');
      const { error: calcError } = await supabase.rpc('calculate_exam_result', { p_attempt_id: attemptId });
      if (calcError) {
        console.error('[GradingDetail] Error calculating result:', calcError);
        throw calcError;
      }

      console.log('[GradingDetail] Updating result with pass decision:', passDecision);
      const { error: resultError } = await supabase
        .from('exam_results')
        .update({
          passed: passDecision,
          graded_by: user.id,
          graded_at: new Date().toISOString()
        })
        .eq('attempt_id', attemptId);

      if (resultError) throw resultError;

      console.log('[GradingDetail] Grades saved successfully');

      sendExamGradedNotification(attemptId).then(notifResult => {
        if (notifResult.success) {
          console.log('[GradingDetail] ✓ WhatsApp notification sent to student');
        } else {
          console.warn('[GradingDetail] ⚠ WhatsApp notification failed:', notifResult.error);
        }
      }).catch(err => {
        console.warn('[GradingDetail] ⚠ Error sending WhatsApp notification:', err);
      });

      alert('Penilaian berhasil disimpan');
      await loadAttemptDetail();
    } catch (error) {
      console.error('[GradingDetail] Error saving grades:', error);
      alert('Gagal menyimpan penilaian');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!attempt || !result) return;
    setDownloadingPdf(true);
    console.log('[GradingDetail] Starting PDF download for attempt:', attemptId);

    try {
      const reportData: ExamReportData = {
        studentName: attempt.applicant.dynamic_data?.nama_lengkap || 'Nama tidak tersedia',
        registrationNumber: attempt.applicant.registration_number || '-',
        examTitle: attempt.exam.title,
        attemptNumber: attempt.attempt_number,
        submittedAt: attempt.submitted_at,
        passingScore: attempt.exam.passing_score,
        result: {
          total_points: result.total_points,
          max_points: result.max_points,
          percentage: result.percentage,
          passed: result.passed,
          grading_status: result.grading_status,
          graded_at: result.graded_at,
        },
        answers: answers.map(a => ({
          question: {
            id: a.question.id,
            question_text: a.question.question_text,
            question_type: a.question.question_type,
            points: a.question.points,
          },
          selected_option_id: a.selected_option_id,
          essay_answer: a.essay_answer,
          points_earned: grades[a.id]?.points ?? a.points_earned ?? 0,
        })),
        allOptions,
        proctoringLogs,
      };

      await generateAdminExamReport(reportData);
      console.log('[GradingDetail] PDF download completed');
    } catch (error) {
      console.error('[GradingDetail] Error generating PDF:', error);
      alert('Gagal generate laporan PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Memuat detail...</p>
        </div>
      </div>
    );
  }

  const ungradedCount = answers.filter(a => {
    const grade = grades[a.id];
    return a.points_earned === null && a.points_earned === undefined && (!grade || grade.points === undefined);
  }).length;

  const needsGrading = answers.some(a => a.points_earned === null || a.points_earned === undefined);
  const mcTfCount = answers.filter(a => a.question.question_type !== 'essay').length;

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'tab_switch': return 'Pindah Tab';
      case 'fullscreen_exit': return 'Keluar Fullscreen';
      case 'copy_attempt': return 'Copy';
      case 'paste_attempt': return 'Paste';
      case 'right_click': return 'Right Click';
      case 'suspicious_activity': return 'Aktivitas Mencurigakan';
      default: return eventType;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'tab_switch': return 'bg-amber-100 text-amber-700';
      case 'fullscreen_exit': return 'bg-red-100 text-red-700';
      case 'copy_attempt': return 'bg-orange-100 text-orange-700';
      case 'paste_attempt': return 'bg-orange-100 text-orange-700';
      case 'right_click': return 'bg-amber-100 text-amber-700';
      case 'suspicious_activity': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const violationSummary: Record<string, number> = {};
  for (const log of proctoringLogs) {
    violationSummary[log.event_type] = (violationSummary[log.event_type] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      <RichContentStyles />
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          &larr; Kembali
        </button>
        <div className="flex items-center gap-3">
          {result?.grading_status === 'completed' && result?.passed !== null && (
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloadingPdf ? 'Generating...' : 'Download Laporan'}
            </button>
          )}
          {mcTfCount > 0 && (
            <button
              onClick={handleApplyAnswerKey}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
            >
              <Key className="h-4 w-4" />
              Sesuai Kunci Jawaban
            </button>
          )}
          <button
            onClick={handleSaveGrades}
            disabled={saving}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Penilaian'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{attempt.exam.title}</h2>
            <div className="flex items-center gap-4 mt-2 text-slate-600">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{attempt.applicant.dynamic_data?.nama_lengkap || 'Nama tidak tersedia'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{format(new Date(attempt.submitted_at), 'dd MMM yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
          {result && (
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-4xl font-bold text-slate-800">
                  {result.percentage.toFixed(1)}%
                </span>
                {result.passed === true && <Award className="h-8 w-8 text-emerald-600" />}
                {result.passed === false && <XCircle className="h-8 w-8 text-red-600" />}
              </div>
              <p className="text-sm text-slate-600">
                {result.total_points.toFixed(1)} / {result.max_points.toFixed(1)} poin
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Passing: {attempt.exam.passing_score}%
              </p>
            </div>
          )}
        </div>

        {result && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-700 mb-1">Total Nilai</p>
              <p className="text-2xl font-bold text-blue-900">{result.total_points.toFixed(1)} / {result.max_points.toFixed(1)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-sm text-emerald-700 mb-1">Persentase</p>
              <p className="text-2xl font-bold text-emerald-900">{result.percentage.toFixed(1)}%</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-amber-700 mb-1">Status Penilaian</p>
              <p className="text-lg font-bold text-amber-900 capitalize">{result.grading_status}</p>
            </div>
          </div>
        )}
      </div>

      {proctoringLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Log Pengawasan</h3>
              <p className="text-sm text-slate-600">{proctoringLogs.length} pelanggaran terdeteksi</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(violationSummary).map(([type, count]) => (
              <span key={type} className={`px-3 py-1.5 rounded-full text-xs font-medium ${getEventColor(type)}`}>
                {getEventLabel(type)}: {count}x
              </span>
            ))}
          </div>

          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Waktu</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Jenis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proctoringLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">
                      {format(new Date(log.timestamp || log.created_at), 'HH:mm:ss')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getEventColor(log.event_type)}`}>
                        {getEventLabel(log.event_type)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {answers.map((answer, index) => {
          const question = answer.question;
          const isEssay = question.question_type === 'essay';
          const questionOptions = allOptions[question.id] || [];
          const correctOption = questionOptions.find((o: any) => o.is_correct);

          return (
            <div key={answer.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                      Soal #{index + 1}
                    </span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      {question.question_type === 'multiple_choice' && 'Pilihan Ganda'}
                      {question.question_type === 'true_false' && 'Benar/Salah'}
                      {question.question_type === 'essay' && 'Essay'}
                    </span>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                      {question.points} poin
                    </span>
                  </div>
                  <div className="text-slate-800 mb-3">
                    <RichContentRenderer content={question.question_text} />
                  </div>
                </div>
              </div>

              {isEssay ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-slate-700 mb-2">Jawaban Siswa:</p>
                    <div className="text-slate-800">
                      {answer.essay_answer ? (
                        <RichContentRenderer content={answer.essay_answer} />
                      ) : (
                        <span className="text-slate-500 italic">Tidak dijawab</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Jawaban Siswa:</p>
                  <div className="space-y-2">
                    {questionOptions.map((opt: any) => {
                      const isSelected = answer.selected_option_id === opt.id;
                      const isCorrectOpt = opt.is_correct;
                      let borderClass = 'border-slate-200 bg-white';
                      if (isSelected && isCorrectOpt) borderClass = 'border-emerald-300 bg-emerald-50';
                      else if (isSelected && !isCorrectOpt) borderClass = 'border-red-300 bg-red-50';
                      else if (isCorrectOpt) borderClass = 'border-emerald-200 bg-emerald-50/50';

                      return (
                        <div key={opt.id} className={`p-3 rounded-lg border-2 ${borderClass} flex items-start justify-between`}>
                          <div className="text-slate-800 flex-1">
                            <RichContentRenderer content={opt.option_text} />
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            {isSelected && <span className="text-xs font-medium text-slate-600 bg-slate-200 px-2 py-0.5 rounded">Dipilih</span>}
                            {isCorrectOpt && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!answer.selected_option_id && (
                    <p className="text-sm text-red-500 italic">Tidak dijawab</p>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nilai (0 - {question.points})
                </label>
                <input
                  type="number"
                  min="0"
                  max={question.points}
                  step="0.5"
                  value={grades[answer.id]?.points ?? 0}
                  onChange={(e) => handleGradeChange(answer.id, Math.min(parseFloat(e.target.value) || 0, question.points))}
                  className="w-full max-w-xs px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {answer.is_flagged && (
                <div className="mt-3 flex items-center gap-2 text-amber-700 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Ditandai oleh siswa untuk review</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Keputusan Lulus / Tidak Lulus</h3>
        <p className="text-sm text-slate-600 mb-4">
          Tentukan keputusan akhir untuk siswa ini. Keputusan ini bersifat manual dan tidak otomatis berdasarkan nilai.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => setPassDecision(true)}
            className={`flex-1 max-w-xs px-6 py-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
              passDecision === true
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                : 'border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50'
            }`}
          >
            <ThumbsUp className="h-6 w-6" />
            <div className="text-left">
              <p className="font-semibold">Lulus</p>
              <p className="text-xs opacity-75">Siswa dinyatakan lulus ujian</p>
            </div>
          </button>
          <button
            onClick={() => setPassDecision(false)}
            className={`flex-1 max-w-xs px-6 py-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
              passDecision === false
                ? 'border-red-500 bg-red-50 text-red-800 ring-2 ring-red-200'
                : 'border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50/50'
            }`}
          >
            <ThumbsDown className="h-6 w-6" />
            <div className="text-left">
              <p className="font-semibold">Tidak Lulus</p>
              <p className="text-xs opacity-75">Siswa dinyatakan tidak lulus</p>
            </div>
          </button>
          {passDecision !== null && (
            <button
              onClick={() => setPassDecision(null)}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm self-center"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="sticky bottom-4 bg-white rounded-xl border border-slate-200 shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-slate-700">
            {needsGrading ? (
              <p>Ada {answers.filter(a => a.points_earned === null || a.points_earned === undefined).length} soal yang perlu dinilai</p>
            ) : (
              <p className="text-emerald-700 font-medium">Semua soal sudah dinilai</p>
            )}
            {passDecision === null && (
              <p className="text-amber-600 text-sm mt-1">Keputusan lulus/tidak lulus belum ditentukan</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {mcTfCount > 0 && (
              <button
                onClick={handleApplyAnswerKey}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2 text-sm"
              >
                <Key className="h-4 w-4" />
                Sesuai Kunci Jawaban
              </button>
            )}
            <button
              onClick={handleSaveGrades}
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Menyimpan...' : 'Simpan Penilaian'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
