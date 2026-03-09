import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trophy, Clock, CheckCircle, XCircle, Award, Download } from 'lucide-react';
import { format } from 'date-fns';
import { generateStudentExamReport, ExamReportData } from '../../lib/examReportGenerator';

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

interface ExamResultsProps {
  applicantId: string;
}

export const ExamResults: React.FC<ExamResultsProps> = ({ applicantId }) => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, [applicantId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      console.log('[ExamResults] Fetching results for applicant:', applicantId);

      const { data: attemptsData, error: attemptsError } = await supabase
        .from('exam_attempts')
        .select('id, exam_id, attempt_number, submitted_at')
        .eq('applicant_id', applicantId)
        .eq('status', 'completed');

      if (attemptsError) throw attemptsError;

      if (attemptsData && attemptsData.length > 0) {
        const attemptIds = attemptsData.map(a => a.id);
        const examIds = [...new Set(attemptsData.map(a => a.exam_id))];

        const { data: examsData } = await supabase.from('exams').select('id, title, passing_score').in('id', examIds);

        const { data: resultsData, error: resultsError } = await supabase
          .from('exam_results')
          .select('*')
          .in('attempt_id', attemptIds)
          .order('created_at', { ascending: false });

        if (resultsError) throw resultsError;

        const enrichedResults = (resultsData || []).map(r => {
          const attempt: any = attemptsData.find(a => a.id === r.attempt_id);
          if (attempt) {
            attempt.exam = examsData?.find(e => e.id === attempt.exam_id) || { title: 'Unknown Exam', passing_score: 0 };
          }
          return { ...r, attempt };
        });

        setResults(enrichedResults);
        console.log('[ExamResults] Loaded results:', enrichedResults.length);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('[ExamResults] Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResult = async (result: ExamResult) => {
    setDownloadingId(result.id);
    console.log('[ExamResults] Starting PDF download for result:', result.id, 'attempt:', result.attempt_id);

    try {
      const { data: rawAttempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', result.attempt_id)
        .single();

      if (attemptError || !rawAttempt) throw attemptError;

      const { data: applicant } = await supabase.from('applicants').select('dynamic_data, registration_number').eq('id', rawAttempt.applicant_id).single();
      const { data: exam } = await supabase.from('exams').select('title, passing_score').eq('id', rawAttempt.exam_id).single();

      const attemptData = {
        ...rawAttempt,
        applicant: applicant || { dynamic_data: {}, registration_number: '-' },
        exam: exam || { title: 'Unknown Exam', passing_score: 0 }
      };

      console.log('[ExamResults] Loaded attempt data for PDF');

      const { data: rawAnswers, error: answersError } = await supabase
        .from('exam_answers')
        .select('*')
        .eq('attempt_id', result.attempt_id);

      if (answersError) throw answersError;

      let answersData: any[] = [];
      if (rawAnswers && rawAnswers.length > 0) {
        const questionIds = [...new Set(rawAnswers.map(a => a.question_id))];
        const { data: questions } = await supabase.from('exam_questions').select('*').in('id', questionIds);

        answersData = rawAnswers.map(a => ({
          ...a,
          question: questions?.find(q => q.id === a.question_id) || { id: a.question_id, question_text: 'Unknown', question_type: 'multiple_choice', points: 0 }
        }));
      }

      console.log('[ExamResults] Loaded', answersData?.length, 'answers for PDF');

      const questionIds = answersData?.map(a => a.question.id) || [];
      const allOptions: Record<string, any[]> = {};
      if (questionIds.length > 0) {
        const { data: optionsData } = await supabase
          .from('exam_question_options')
          .select('*')
          .in('question_id', questionIds)
          .order('order_index', { ascending: true });

        if (optionsData) {
          for (const opt of optionsData) {
            if (!allOptions[opt.question_id]) allOptions[opt.question_id] = [];
            allOptions[opt.question_id].push(opt);
          }
        }
        console.log('[ExamResults] Loaded options for', Object.keys(allOptions).length, 'questions');
      }

      const reportData: ExamReportData = {
        studentName: attemptData.applicant.dynamic_data?.nama_lengkap || '-',
        registrationNumber: attemptData.applicant.registration_number || '-',
        examTitle: attemptData.exam.title,
        attemptNumber: attemptData.attempt_number,
        submittedAt: attemptData.submitted_at,
        passingScore: attemptData.exam.passing_score,
        result: {
          total_points: result.total_points,
          max_points: result.max_points,
          percentage: result.percentage,
          passed: result.passed,
          grading_status: result.grading_status,
        },
        answers: (answersData || []).map(a => ({
          question: {
            id: a.question.id,
            question_text: a.question.question_text,
            question_type: a.question.question_type,
            points: a.question.points,
          },
          selected_option_id: a.selected_option_id,
          essay_answer: a.essay_answer,
          points_earned: a.points_earned ?? 0,
        })),
        allOptions,
      };

      await generateStudentExamReport(reportData);
      console.log('[ExamResults] PDF download completed');
    } catch (error) {
      console.error('[ExamResults] Error generating PDF:', error);
      alert('Gagal generate laporan PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Memuat hasil...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl">
        <Trophy className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-600">Belum ada hasil ujian</p>
        <p className="text-sm text-slate-500 mt-2">
          Hasil akan muncul setelah Anda menyelesaikan ujian
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-4">Hasil Ujian Saya</h3>
        <p className="text-slate-600">Status ujian yang telah Anda selesaikan</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((result) => {
          const isGraded = result.grading_status === 'completed' && result.passed !== null;
          const isPending = !isGraded;

          return (
            <div
              key={result.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <div className={`h-2 ${isPending ? 'bg-amber-400' : result.passed ? 'bg-emerald-500' : 'bg-red-500'
                }`}></div>

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 mb-1">{result.attempt.exam.title}</h4>
                    <p className="text-xs text-slate-500">
                      Percobaan #{result.attempt.attempt_number}
                    </p>
                  </div>
                  {isPending ? (
                    <Clock className="h-8 w-8 text-amber-500" />
                  ) : result.passed ? (
                    <Award className="h-8 w-8 text-emerald-600" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-600" />
                  )}
                </div>

                {isPending ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-amber-800 mb-1">Menunggu Penilaian</p>
                    <p className="text-xs text-amber-700">
                      Hasil ujian Anda sedang dalam proses penilaian oleh admin. Silakan cek kembali nanti.
                    </p>
                  </div>
                ) : (
                  <div className={`rounded-lg p-4 mb-4 ${result.passed ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {result.passed ? (
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <p className={`text-lg font-bold ${result.passed ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                        {result.passed ? 'LULUS' : 'TIDAK LULUS'}
                      </p>
                    </div>
                    <p className={`text-xs ${result.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                      {result.passed
                        ? 'Selamat, Anda dinyatakan lulus ujian ini.'
                        : 'Maaf, Anda dinyatakan tidak lulus ujian ini.'}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Waktu:</span>
                  <span className="text-slate-800">
                    {format(new Date(result.attempt.submitted_at), 'dd MMM yyyy')}
                  </span>
                </div>

                {isGraded && (
                  <button
                    onClick={() => handleDownloadResult(result)}
                    disabled={downloadingId === result.id}
                    className="mt-4 w-full px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    {downloadingId === result.id ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download Hasil
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
