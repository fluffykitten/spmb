import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, Flag, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Send, X, Maximize } from 'lucide-react';
import { sendExamSubmittedNotification } from '../../lib/examNotifications';
import { RichContentRenderer, RichContentStyles } from '../shared/RichContentRenderer';
import { RichTextEditor } from '../shared/RichTextEditor';

interface Exam {
  id: string;
  title: string;
  instructions: string;
  duration_minutes: number;
  randomize_questions: boolean;
  randomize_options: boolean;
  enable_proctoring: boolean;
  require_fullscreen: boolean;
}

interface Question {
  id: string;
  question_type: 'multiple_choice' | 'true_false' | 'essay';
  question_text: string;
  question_image: string | null;
  points: number;
  order_index: number;
}

interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  option_image: string | null;
  is_correct: boolean;
  order_index: number;
}

interface Answer {
  question_id: string;
  selected_option_id?: string;
  essay_answer?: string;
  is_flagged: boolean;
}

interface ExamTakingProps {
  examId: string;
  applicantId: string;
  tokenId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export const ExamTaking: React.FC<ExamTakingProps> = ({ examId, applicantId, tokenId, onComplete, onCancel }) => {
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<Record<string, QuestionOption[]>>({});
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [proctoringWarnings, setProctoringWarnings] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<Date>(new Date());
  const examRef = useRef<Exam | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const showInstructionsRef = useRef(true);
  const isCompletingExamRef = useRef(false);

  useEffect(() => {
    examRef.current = exam;
  }, [exam]);

  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  useEffect(() => {
    showInstructionsRef.current = showInstructions;
  }, [showInstructions]);

  useEffect(() => {
    loadExam();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, []);

  useEffect(() => {
    if (!exam?.enable_proctoring) {
      console.log('[Proctoring] Skipping listener setup - proctoring not enabled or exam not loaded');
      return;
    }

    if (showInstructions) {
      console.log('[Proctoring] Skipping listener setup - still on instructions screen');
      return;
    }

    if (!attemptId) {
      console.log('[Proctoring] Skipping listener setup - no attemptId yet');
      return;
    }

    console.log('[Proctoring] Setting up listeners for attempt:', attemptId);
    setupProctoringListeners();

    return () => {
      console.log('[Proctoring] Cleaning up listeners on unmount');
      isCompletingExamRef.current = true;
      removeProctoringListeners();
    };
  }, [exam, showInstructions, attemptId]);

  const loadExam = async () => {
    try {
      setLoading(true);

      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examError) throw examError;
      setExam(examData);

      const { data: questionsData, error: questionsError } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;

      let processedQuestions = questionsData || [];
      if (examData.randomize_questions) {
        processedQuestions = [...processedQuestions].sort(() => Math.random() - 0.5);
      }
      setQuestions(processedQuestions);

      if (processedQuestions.length > 0) {
        const questionIds = processedQuestions.map(q => q.id);
        const { data: optionsData, error: optionsError } = await supabase
          .from('exam_question_options')
          .select('*')
          .in('question_id', questionIds)
          .order('order_index', { ascending: true });

        if (optionsError) throw optionsError;

        const optionsByQuestion: Record<string, QuestionOption[]> = {};
        if (optionsData) {
          for (const option of optionsData) {
            if (!optionsByQuestion[option.question_id]) {
              optionsByQuestion[option.question_id] = [];
            }
            optionsByQuestion[option.question_id].push(option);
          }

          if (examData.randomize_options) {
            for (const qid in optionsByQuestion) {
              optionsByQuestion[qid] = [...optionsByQuestion[qid]].sort(() => Math.random() - 0.5);
            }
          }
        }
        setOptions(optionsByQuestion);
      }

      setTimeRemaining(examData.duration_minutes * 60);
    } catch (error) {
      console.error('Error loading exam:', error);
      alert('Gagal memuat data ujian');
      onCancel();
    } finally {
      setLoading(false);
    }
  };

  const startExam = async () => {
    try {
      console.log('Starting exam with token_id:', tokenId);

      const { data: attemptData, error: attemptError } = await supabase
        .from('exam_attempts')
        .insert({
          exam_id: examId,
          applicant_id: applicantId,
          attempt_number: 1,
          status: 'in_progress',
          time_remaining_seconds: exam?.duration_minutes ? exam.duration_minutes * 60 : 3600,
          ip_address: null,
          user_agent: navigator.userAgent,
          token_id: tokenId
        })
        .select()
        .single();

      if (attemptError) {
        console.error('Error creating attempt:', attemptError);
        throw attemptError;
      }
      console.log('Exam attempt created:', attemptData.id);
      setAttemptId(attemptData.id);

      if (exam?.require_fullscreen) {
        requestFullscreen();
      }

      setShowInstructions(false);

      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmitExam(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      autoSaveRef.current = setInterval(() => {
        autoSaveAnswers();
      }, 30000);
    } catch (error) {
      console.error('Error starting exam:', error);
      alert('Gagal memulai ujian');
      onCancel();
    }
  };

  const autoSaveAnswers = async (force = false) => {
    if (!attemptId) return;

    const now = new Date();
    if (!force && now.getTime() - lastSaveRef.current.getTime() < 15000) {
      console.log('Skipping auto-save (too soon since last save)');
      return;
    }

    try {
      const answersToSave = Object.entries(answers).map(([questionId, answer]) => ({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option_id: answer.selected_option_id || null,
        essay_answer: answer.essay_answer || null,
        is_flagged: answer.is_flagged
      }));

      console.log('Saving answers:', answersToSave.length, 'questions');

      if (answersToSave.length > 0) {
        for (const answer of answersToSave) {
          const { error } = await supabase
            .from('exam_answers')
            .upsert(answer, {
              onConflict: 'attempt_id,question_id'
            });

          if (error) {
            console.error('Error saving answer:', error);
            throw error;
          }
        }

        await supabase
          .from('exam_attempts')
          .update({ time_remaining_seconds: timeRemaining })
          .eq('id', attemptId);

        lastSaveRef.current = now;
        console.log('Successfully saved', answersToSave.length, 'answers at', now.toLocaleTimeString());
      } else {
        console.log('No answers to save');
      }
    } catch (error) {
      console.error('Error auto-saving:', error);
      throw error;
    }
  };

  const handleSubmitExam = async (isTimeout = false) => {
    if (!attemptId) {
      console.error('No attempt ID found');
      return;
    }

    console.log('=== STARTING EXAM SUBMISSION ===');
    console.log('Attempt ID:', attemptId);
    console.log('Is Timeout:', isTimeout);
    console.log('Total answers:', Object.keys(answers).length);

    if (!isTimeout) {
      const unanswered = questions.filter(q => !answers[q.id] ||
        (q.question_type !== 'essay' && !answers[q.id].selected_option_id) ||
        (q.question_type === 'essay' && !answers[q.id].essay_answer?.trim())
      ).length;

      console.log('Unanswered questions:', unanswered);

      console.log('[Proctoring] Disabling listeners before confirm dialog to prevent false warnings');
      isCompletingExamRef.current = true;
      removeProctoringListeners();

      let confirmed = false;
      if (unanswered > 0) {
        confirmed = confirm(`Masih ada ${unanswered} soal yang belum dijawab. Yakin ingin submit?`);
      } else {
        confirmed = confirm('Yakin ingin submit ujian? Anda tidak dapat mengubah jawaban setelah submit.');
      }

      if (!confirmed) {
        console.log('[Proctoring] User cancelled submit, re-enabling listeners');
        isCompletingExamRef.current = false;
        setupProctoringListeners();
        if (exam?.require_fullscreen) {
          requestFullscreen();
        }
        return;
      }
    } else {
      isCompletingExamRef.current = true;
      removeProctoringListeners();
    }

    setSubmitting(true);

    try {
      console.log('Stopping timers...');
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);

      console.log('=== SAVING ALL ANSWERS BEFORE SUBMIT ===');
      console.log('Force saving', Object.keys(answers).length, 'answers before submission...');

      try {
        await autoSaveAnswers(true);
        console.log('All answers saved successfully before submit');
      } catch (saveError) {
        console.error('Failed to save answers before submit:', saveError);
        throw new Error('Gagal menyimpan jawaban sebelum submit. Silakan coba lagi.');
      }

      console.log('Updating attempt status to completed...');
      const { error: updateError } = await supabase
        .from('exam_attempts')
        .update({
          status: 'completed',
          submitted_at: new Date().toISOString(),
          time_remaining_seconds: timeRemaining
        })
        .eq('id', attemptId);

      if (updateError) {
        console.error('Error updating attempt:', updateError);
        throw updateError;
      }

      console.log('Calculating exam result...');
      const { error: calcError } = await supabase.rpc('calculate_exam_result', { p_attempt_id: attemptId });

      if (calcError) {
        console.error('Error calculating result:', calcError);
        throw calcError;
      }

      console.log('=== EXAM SUBMISSION COMPLETED ===');

      sendExamSubmittedNotification(attemptId).then(result => {
        if (result.success) {
          console.log('WhatsApp notification sent successfully');
        } else {
          console.warn('WhatsApp notification failed:', result.error);
        }
      }).catch(err => {
        console.warn('Error sending WhatsApp notification:', err);
      });

      if (isTimeout) {
        alert('Waktu ujian habis! Jawaban Anda telah otomatis tersimpan.');
      }

      exitFullscreen();
      onComplete();
    } catch (error) {
      console.error('Error submitting exam:', error);
      const errorMessage = error instanceof Error ? error.message : 'Gagal submit ujian. Silakan coba lagi.';
      alert(errorMessage);
      isCompletingExamRef.current = false;
      setupProctoringListeners();
      setSubmitting(false);
    }
  };

  const setupProctoringListeners = () => {
    if (!exam?.enable_proctoring) return;

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('blur', handleWindowBlur);
  };

  const removeProctoringListeners = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('copy', handleCopy);
    document.removeEventListener('paste', handlePaste);
    window.removeEventListener('blur', handleWindowBlur);
  };

  const logProctoringEvent = useCallback(async (eventType: string, eventData: any = {}) => {
    const currentAttemptId = attemptIdRef.current;
    const currentExam = examRef.current;

    if (!currentAttemptId || !currentExam?.enable_proctoring) {
      console.log('[Proctoring] Skipping log - attemptId:', currentAttemptId, 'proctoring:', currentExam?.enable_proctoring);
      return;
    }

    console.log('[Proctoring] Logging event:', eventType, 'for attempt:', currentAttemptId);

    try {
      const { error } = await supabase.from('exam_proctoring_logs').insert({
        attempt_id: currentAttemptId,
        event_type: eventType,
        event_data: eventData
      });

      if (error) {
        console.error('[Proctoring] Failed to log event:', error);
      } else {
        console.log('[Proctoring] Event logged successfully:', eventType);
      }

      setProctoringWarnings(prev => prev + 1);
    } catch (error) {
      console.error('[Proctoring] Error logging proctoring event:', error);
    }
  }, []);

  const handleVisibilityChange = useCallback(() => {
    if (isCompletingExamRef.current) {
      console.log('[Proctoring] Visibility change during exam completion - ignoring');
      return;
    }
    if (document.hidden) {
      console.log('[Proctoring] Tab switch detected');
      logProctoringEvent('tab_switch', { timestamp: new Date().toISOString() });
      alert('Peringatan: Jangan berpindah tab! Aktivitas ini telah dicatat.');
    }
  }, [logProctoringEvent]);

  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!document.fullscreenElement;
    setIsFullscreen(isCurrentlyFullscreen);

    if (isCompletingExamRef.current) {
      console.log('[Proctoring] Fullscreen change during exam completion - ignoring');
      return;
    }

    if (!isCurrentlyFullscreen && examRef.current?.require_fullscreen && !showInstructionsRef.current) {
      console.log('[Proctoring] Fullscreen exit detected');
      logProctoringEvent('fullscreen_exit', { timestamp: new Date().toISOString() });
      alert('Peringatan: Anda keluar dari mode fullscreen. Mohon kembali ke mode fullscreen.');
      requestFullscreen();
    }
  }, [logProctoringEvent]);

  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault();
    console.log('[Proctoring] Right-click detected');
    logProctoringEvent('right_click', { timestamp: new Date().toISOString() });
    alert('Peringatan: Right-click tidak diperbolehkan selama ujian! Aktivitas ini telah dicatat.');
  }, [logProctoringEvent]);

  const handleCopy = useCallback((e: Event) => {
    e.preventDefault();
    console.log('[Proctoring] Copy attempt detected');
    logProctoringEvent('copy_attempt', { timestamp: new Date().toISOString() });
    alert('Peringatan: Copy tidak diperbolehkan selama ujian! Aktivitas ini telah dicatat.');
  }, [logProctoringEvent]);

  const handlePaste = useCallback((e: Event) => {
    console.log('[Proctoring] Paste attempt detected');
    logProctoringEvent('paste_attempt', { timestamp: new Date().toISOString() });
    alert('Peringatan: Aktivitas paste terdeteksi! Aktivitas ini telah dicatat.');
  }, [logProctoringEvent]);

  const handleWindowBlur = useCallback(() => {
    if (isCompletingExamRef.current) {
      console.log('[Proctoring] Window blur during exam completion - ignoring');
      return;
    }
    console.log('[Proctoring] Window blur detected');
    logProctoringEvent('suspicious_activity', {
      type: 'window_blur',
      timestamp: new Date().toISOString()
    });
  }, [logProctoringEvent]);

  const requestFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => {
        console.error('Error attempting fullscreen:', err);
      });
    }
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleAnswerChange = (questionId: string, optionId?: string, essayText?: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        selected_option_id: optionId,
        essay_answer: essayText,
        is_flagged: prev[questionId]?.is_flagged || false
      }
    }));
  };

  const handleToggleFlag = (questionId: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        question_id: questionId,
        is_flagged: !prev[questionId]?.is_flagged
      }
    }));
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (timeRemaining <= 300) return 'text-red-600';
    if (timeRemaining <= 600) return 'text-amber-600';
    return 'text-slate-700';
  };

  const handleCancelExam = () => {
    console.log('[Proctoring] Disabling listeners before cancel confirm dialog');
    isCompletingExamRef.current = true;
    removeProctoringListeners();

    if (!confirm('Yakin ingin keluar? Progres Anda akan tersimpan.')) {
      console.log('[Proctoring] User cancelled exit, re-enabling listeners');
      isCompletingExamRef.current = false;
      setupProctoringListeners();
      if (exam?.require_fullscreen) {
        requestFullscreen();
      }
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);

    if (attemptId) {
      autoSaveAnswers().then(() => {
        exitFullscreen();
        onCancel();
      });
    } else {
      exitFullscreen();
      onCancel();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-700">Memuat ujian...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-8 max-w-md">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-center mb-2">Ujian Tidak Tersedia</h3>
          <p className="text-slate-600 text-center mb-6">
            Maaf, ujian tidak dapat dimuat. Silakan hubungi admin.
          </p>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (showInstructions) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl max-w-3xl w-full my-8">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800">{exam.title}</h2>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Petunjuk Ujian</h3>
              <div className="text-sm text-blue-800 whitespace-pre-wrap">{exam.instructions}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-5 w-5 text-slate-600" />
                  <span className="font-semibold text-slate-700">Durasi</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">{exam.duration_minutes} menit</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-5 w-5 text-slate-600" />
                  <span className="font-semibold text-slate-700">Jumlah Soal</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">{questions.length}</p>
              </div>
            </div>

            {exam.enable_proctoring && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-2">Monitoring Aktif</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Jangan berpindah tab atau window</li>
                      <li>Jangan keluar dari mode fullscreen</li>
                      <li>Jangan menggunakan right-click</li>
                      <li>Aktivitas mencurigakan akan dicatat</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-700 mb-2">Hal Penting:</h4>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li>Pastikan koneksi internet stabil</li>
                <li>Jawaban akan otomatis tersimpan setiap 30 detik</li>
                <li>Klik tombol SUBMIT setelah selesai mengerjakan</li>
                <li>Anda tidak dapat mengubah jawaban setelah submit</li>
              </ul>
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 flex gap-3">
            <button
              onClick={handleCancelExam}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={startExam}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Mulai Ujian
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion.id];
  const answeredCount = Object.keys(answers).filter(qid => {
    const q = questions.find(qu => qu.id === qid);
    const a = answers[qid];
    if (!q || !a) return false;
    if (q.question_type === 'essay') return a.essay_answer?.trim();
    return a.selected_option_id;
  }).length;
  const flaggedCount = Object.values(answers).filter(a => a.is_flagged).length;

  return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col">
      <RichContentStyles />
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="font-bold text-slate-800">{exam.title}</h2>
            <p className="text-sm text-slate-600">
              Soal {currentQuestionIndex + 1} dari {questions.length}
            </p>
          </div>
          {exam.enable_proctoring && proctoringWarnings > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{proctoringWarnings} peringatan</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 font-mono text-lg font-bold ${getTimeColor()}`}>
            <Clock className="h-5 w-5" />
            {formatTime(timeRemaining)}
          </div>
          <button
            onClick={() => requestFullscreen()}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            title="Fullscreen"
          >
            <Maximize className="h-5 w-5" />
          </button>
          <button
            onClick={handleCancelExam}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            title="Keluar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      Soal #{currentQuestionIndex + 1}
                    </span>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                      {currentQuestion.points} poin
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                      {currentQuestion.question_type === 'multiple_choice' && 'Pilihan Ganda'}
                      {currentQuestion.question_type === 'true_false' && 'Benar/Salah'}
                      {currentQuestion.question_type === 'essay' && 'Essay'}
                    </span>
                  </div>
                  <div className="text-lg text-slate-800 leading-relaxed">
                    <RichContentRenderer content={currentQuestion.question_text} />
                  </div>
                </div>
                <button
                  onClick={() => handleToggleFlag(currentQuestion.id)}
                  className={`ml-4 p-2 rounded-lg transition-colors ${
                    currentAnswer?.is_flagged
                      ? 'bg-amber-100 text-amber-700'
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title="Tandai untuk review"
                >
                  <Flag className="h-5 w-5" fill={currentAnswer?.is_flagged ? 'currentColor' : 'none'} />
                </button>
              </div>

              {currentQuestion.question_type === 'essay' ? (
                <div className="mt-6">
                  <RichTextEditor
                    value={currentAnswer?.essay_answer || ''}
                    onChange={(html) => handleAnswerChange(currentQuestion.id, undefined, html)}
                    placeholder="Tulis jawaban Anda di sini... Gunakan toolbar untuk memformat teks atau menambahkan gambar."
                    minHeight="250px"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    Gunakan toolbar di atas untuk memformat jawaban Anda
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {options[currentQuestion.id]?.map((option, index) => (
                    <label
                      key={option.id}
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        currentAnswer?.selected_option_id === option.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        checked={currentAnswer?.selected_option_id === option.id}
                        onChange={() => handleAnswerChange(currentQuestion.id, option.id)}
                        className="mt-1 text-blue-600"
                      />
                      <div className="flex-1">
                        <span className="font-mono text-sm text-slate-600 mr-2">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        <span className="text-slate-800">
                          <RichContentRenderer content={option.option_text} inline />
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ChevronLeft className="h-5 w-5" />
                Sebelumnya
              </button>

              {currentQuestionIndex === questions.length - 1 ? (
                <button
                  onClick={() => handleSubmitExam(false)}
                  disabled={submitting}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-semibold"
                >
                  <Send className="h-5 w-5" />
                  {submitting ? 'Mengirim...' : 'Submit Ujian'}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  Selanjutnya
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Status Pengerjaan</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-700 mb-1">Terjawab</p>
                  <p className="text-2xl font-bold text-emerald-700">{answeredCount}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-700 mb-1">Ditandai</p>
                  <p className="text-2xl font-bold text-amber-700">{flaggedCount}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-3">Navigasi Soal</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, index) => {
                  const answer = answers[q.id];
                  const isAnswered = q.question_type === 'essay'
                    ? answer?.essay_answer?.trim()
                    : answer?.selected_option_id;
                  const isFlagged = answer?.is_flagged;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(index)}
                      className={`aspect-square rounded-lg font-semibold text-sm transition-all relative ${
                        currentQuestionIndex === index
                          ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                          : isAnswered
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {index + 1}
                      {isFlagged && (
                        <Flag
                          className="absolute -top-1 -right-1 h-3 w-3 text-amber-600"
                          fill="currentColor"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={() => handleSubmitExam(false)}
                disabled={submitting}
                className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
              >
                <Send className="h-5 w-5" />
                {submitting ? 'Mengirim...' : 'Submit Ujian'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
