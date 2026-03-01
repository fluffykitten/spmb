import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, ChevronUp, ChevronDown, Save, X, Check } from 'lucide-react';
import { RichTextEditor } from '../shared/RichTextEditor';
import { RichContentRenderer, RichContentStyles } from '../shared/RichContentRenderer';

interface Question {
  id: string;
  question_type: 'multiple_choice' | 'true_false' | 'essay';
  question_text: string;
  question_image: string | null;
  points: number;
  order_index: number;
  explanation: string | null;
}

interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  option_image: string | null;
  is_correct: boolean;
  order_index: number;
}

interface QuestionManagerProps {
  examId: string;
  examTitle: string;
  onClose: () => void;
}

export const QuestionManager: React.FC<QuestionManagerProps> = ({ examId, examTitle, onClose }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<Record<string, QuestionOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, [examId]);

  const fetchQuestions = async () => {
    try {
      console.log('[QuestionManager] Fetching questions for exam:', examId);
      setLoading(true);

      const { data: questionsData, error: questionsError } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;

      if (questionsData && questionsData.length > 0) {
        console.log('[QuestionManager] Found', questionsData.length, 'questions');
        setQuestions(questionsData);

        const { data: optionsData, error: optionsError } = await supabase
          .from('exam_question_options')
          .select('*')
          .in('question_id', questionsData.map(q => q.id))
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
        }
        setOptions(optionsByQuestion);
      } else {
        console.log('[QuestionManager] No questions found');
        setQuestions([]);
        setOptions({});
      }
    } catch (error) {
      console.error('[QuestionManager] Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Yakin ingin menghapus soal ini?')) return;

    try {
      console.log('[QuestionManager] Deleting question:', questionId);
      const { error } = await supabase
        .from('exam_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
      await fetchQuestions();
    } catch (error) {
      console.error('[QuestionManager] Error deleting question:', error);
      alert('Gagal menghapus soal');
    }
  };

  const handleMoveQuestion = async (questionId: string, direction: 'up' | 'down') => {
    const currentIndex = questions.findIndex(q => q.id === questionId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    console.log('[QuestionManager] Moving question', questionId, direction);

    const updates = [
      {
        id: questions[currentIndex].id,
        order_index: targetIndex
      },
      {
        id: questions[targetIndex].id,
        order_index: currentIndex
      }
    ];

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('exam_questions')
          .update({ order_index: update.order_index })
          .eq('id', update.id);

        if (error) throw error;
      }

      await fetchQuestions();
    } catch (error) {
      console.error('[QuestionManager] Error reordering questions:', error);
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'multiple_choice': return 'Pilihan Ganda';
      case 'true_false': return 'Benar/Salah';
      case 'essay': return 'Essay';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <RichContentStyles />
      <div className="bg-white rounded-xl max-w-6xl w-full my-8">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Kelola Soal Ujian</h3>
            <p className="text-sm text-slate-600 mt-1">{examTitle}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Tambah Soal
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {questions.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl">
              <p className="text-slate-600">Belum ada soal</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tambah Soal Pertama
              </button>
            </div>
          ) : (
            questions.map((question, index) => (
              <div key={question.id} className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveQuestion(question.id, 'up')}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveQuestion(question.id, 'down')}
                        disabled={index === questions.length - 1}
                        className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-slate-800">Soal #{index + 1}</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {getQuestionTypeLabel(question.question_type)}
                        </span>
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                          {question.points} poin
                        </span>
                      </div>
                      <div className="text-slate-700 mb-3">
                        <RichContentRenderer content={question.question_text} />
                      </div>

                      {question.question_type !== 'essay' && options[question.id] && (
                        <div className="space-y-2 ml-4">
                          {options[question.id].map((option, optIndex) => (
                            <div
                              key={option.id}
                              className={`flex items-start gap-2 p-2 rounded ${
                                option.is_correct ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-slate-200'
                              }`}
                            >
                              <span className="font-mono text-sm text-slate-600 mt-0.5">
                                {String.fromCharCode(65 + optIndex)}.
                              </span>
                              <div className={`flex-1 ${option.is_correct ? 'text-emerald-900 font-medium' : 'text-slate-700'}`}>
                                <RichContentRenderer content={option.option_text} />
                              </div>
                              {option.is_correct && (
                                <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {question.explanation && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs font-medium text-blue-900 mb-1">Penjelasan:</p>
                          <div className="text-sm text-blue-800">
                            <RichContentRenderer content={question.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingQuestion(question.id)}
                      className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showAddModal && (
        <QuestionFormModal
          examId={examId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchQuestions();
          }}
          orderIndex={questions.length}
        />
      )}

      {editingQuestion && (
        <QuestionFormModal
          examId={examId}
          questionId={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSuccess={() => {
            setEditingQuestion(null);
            fetchQuestions();
          }}
        />
      )}
    </div>
  );
};

interface QuestionFormModalProps {
  examId: string;
  questionId?: string;
  orderIndex?: number;
  onClose: () => void;
  onSuccess: () => void;
}

const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  examId,
  questionId,
  orderIndex = 0,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    question_type: 'multiple_choice' as 'multiple_choice' | 'true_false' | 'essay',
    question_text: '',
    points: 1,
    explanation: ''
  });
  const [optionsData, setOptionsData] = useState<Array<{ text: string; isCorrect: boolean }>>([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (questionId) {
      loadQuestion();
    }
  }, [questionId]);

  const loadQuestion = async () => {
    if (!questionId) return;

    try {
      console.log('[QuestionFormModal] Loading question:', questionId);
      setLoading(true);

      const { data: questionData, error: questionError } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (questionError) throw questionError;

      setFormData({
        question_type: questionData.question_type,
        question_text: questionData.question_text,
        points: questionData.points,
        explanation: questionData.explanation || ''
      });

      if (questionData.question_type !== 'essay') {
        const { data: optionsData, error: optionsError } = await supabase
          .from('exam_question_options')
          .select('*')
          .eq('question_id', questionId)
          .order('order_index', { ascending: true });

        if (optionsError) throw optionsError;

        if (optionsData && optionsData.length > 0) {
          setOptionsData(optionsData.map(opt => ({
            text: opt.option_text,
            isCorrect: opt.is_correct
          })));
        }
      }
      console.log('[QuestionFormModal] Question loaded successfully');
    } catch (error) {
      console.error('[QuestionFormModal] Error loading question:', error);
      alert('Gagal memuat data soal');
    } finally {
      setLoading(false);
    }
  };

  const stripHtmlTags = (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[QuestionFormModal] Submitting form');
    setSubmitting(true);

    try {
      const questionTextContent = stripHtmlTags(formData.question_text).trim();
      if (!questionTextContent) {
        alert('Pertanyaan tidak boleh kosong');
        setSubmitting(false);
        return;
      }

      if (formData.question_type !== 'essay') {
        const hasCorrectAnswer = optionsData.some(opt => {
          const textContent = stripHtmlTags(opt.text).trim();
          return opt.isCorrect && textContent;
        });
        if (!hasCorrectAnswer) {
          alert('Pilih minimal satu jawaban yang benar');
          setSubmitting(false);
          return;
        }

        const filledOptions = optionsData.filter(opt => stripHtmlTags(opt.text).trim());
        if (filledOptions.length < 2) {
          alert('Minimal harus ada 2 pilihan jawaban');
          setSubmitting(false);
          return;
        }
      }

      if (questionId) {
        console.log('[QuestionFormModal] Updating existing question');
        const { error: questionError } = await supabase
          .from('exam_questions')
          .update({
            question_type: formData.question_type,
            question_text: formData.question_text,
            points: formData.points,
            explanation: formData.explanation || null
          })
          .eq('id', questionId);

        if (questionError) throw questionError;

        if (formData.question_type !== 'essay') {
          await supabase
            .from('exam_question_options')
            .delete()
            .eq('question_id', questionId);

          const filledOptions = optionsData.filter(opt => stripHtmlTags(opt.text).trim());
          const optionsToInsert = filledOptions.map((opt, idx) => ({
            question_id: questionId,
            option_text: opt.text,
            is_correct: opt.isCorrect,
            order_index: idx
          }));

          const { error: optionsError } = await supabase
            .from('exam_question_options')
            .insert(optionsToInsert);

          if (optionsError) throw optionsError;
        }
      } else {
        console.log('[QuestionFormModal] Creating new question');
        const { data: questionData, error: questionError } = await supabase
          .from('exam_questions')
          .insert({
            exam_id: examId,
            question_type: formData.question_type,
            question_text: formData.question_text,
            points: formData.points,
            explanation: formData.explanation || null,
            order_index: orderIndex
          })
          .select()
          .single();

        if (questionError) throw questionError;

        if (formData.question_type !== 'essay') {
          const filledOptions = optionsData.filter(opt => stripHtmlTags(opt.text).trim());
          const optionsToInsert = filledOptions.map((opt, idx) => ({
            question_id: questionData.id,
            option_text: opt.text,
            is_correct: opt.isCorrect,
            order_index: idx
          }));

          const { error: optionsError } = await supabase
            .from('exam_question_options')
            .insert(optionsToInsert);

          if (optionsError) throw optionsError;
        }
      }

      console.log('[QuestionFormModal] Question saved successfully');
      onSuccess();
    } catch (error) {
      console.error('[QuestionFormModal] Error saving question:', error);
      alert('Gagal menyimpan soal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddOption = () => {
    console.log('[QuestionFormModal] Adding new option');
    setOptionsData([...optionsData, { text: '', isCorrect: false }]);
  };

  const handleRemoveOption = (index: number) => {
    if (optionsData.length <= 2) {
      alert('Minimal harus ada 2 pilihan jawaban');
      return;
    }
    console.log('[QuestionFormModal] Removing option at index:', index);
    setOptionsData(optionsData.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, text: string) => {
    const newOptions = [...optionsData];
    newOptions[index].text = text;
    setOptionsData(newOptions);
  };

  const handleCorrectChange = (index: number) => {
    const newOptions = [...optionsData];
    if (formData.question_type === 'true_false') {
      newOptions.forEach((opt, i) => {
        opt.isCorrect = i === index;
      });
    } else {
      newOptions[index].isCorrect = !newOptions[index].isCorrect;
    }
    setOptionsData(newOptions);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
        <div className="bg-white rounded-xl p-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] overflow-y-auto">
      <div className="bg-white rounded-xl max-w-4xl w-full my-8">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">
            {questionId ? 'Edit Soal' : 'Tambah Soal Baru'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Gunakan toolbar untuk memformat teks, menambahkan gambar, atau membuat tabel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tipe Soal</label>
              <select
                value={formData.question_type}
                onChange={(e) => {
                  const newType = e.target.value as 'multiple_choice' | 'true_false' | 'essay';
                  console.log('[QuestionFormModal] Changing question type to:', newType);
                  setFormData({ ...formData, question_type: newType });

                  if (newType === 'true_false') {
                    setOptionsData([
                      { text: 'Benar', isCorrect: true },
                      { text: 'Salah', isCorrect: false }
                    ]);
                  } else if (newType === 'multiple_choice' && optionsData.length === 2) {
                    setOptionsData([
                      { text: '', isCorrect: true },
                      { text: '', isCorrect: false },
                      { text: '', isCorrect: false },
                      { text: '', isCorrect: false }
                    ]);
                  }
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={!!questionId}
              >
                <option value="multiple_choice">Pilihan Ganda</option>
                <option value="true_false">Benar/Salah</option>
                <option value="essay">Essay</option>
              </select>
              {questionId && (
                <p className="text-xs text-slate-500 mt-1">Tipe soal tidak dapat diubah setelah dibuat</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Poin</label>
              <input
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseFloat(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                min="0.5"
                step="0.5"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pertanyaan</label>
            <RichTextEditor
              value={formData.question_text}
              onChange={(html) => setFormData({ ...formData, question_text: html })}
              placeholder="Tulis pertanyaan di sini... Anda dapat menambahkan gambar, tabel, dan format teks."
              minHeight="150px"
              examId={examId}
            />
          </div>

          {formData.question_type !== 'essay' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pilihan Jawaban
                {formData.question_type === 'multiple_choice' && (
                  <span className="text-xs text-slate-500 ml-2">(Centang jawaban yang benar)</span>
                )}
              </label>
              <div className="space-y-3">
                {optionsData.map((option, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type={formData.question_type === 'true_false' ? 'radio' : 'checkbox'}
                        checked={option.isCorrect}
                        onChange={() => handleCorrectChange(index)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span className="font-mono text-sm text-slate-600 w-6">
                        {String.fromCharCode(65 + index)}.
                      </span>
                    </div>
                    <div className="flex-1">
                      {formData.question_type === 'true_false' ? (
                        <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700">
                          {option.text}
                        </div>
                      ) : (
                        <RichTextEditor
                          value={option.text}
                          onChange={(html) => handleOptionChange(index, html)}
                          placeholder={`Pilihan ${String.fromCharCode(65 + index)}`}
                          minHeight="60px"
                          examId={examId}
                          compact
                        />
                      )}
                    </div>
                    {formData.question_type === 'multiple_choice' && optionsData.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {formData.question_type === 'multiple_choice' && optionsData.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Pilihan
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Penjelasan (Opsional)
              <span className="text-xs text-slate-500 ml-2">Ditampilkan setelah menjawab jika diaktifkan</span>
            </label>
            <RichTextEditor
              value={formData.explanation}
              onChange={(html) => setFormData({ ...formData, explanation: html })}
              placeholder="Penjelasan jawaban yang benar..."
              minHeight="100px"
              examId={examId}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {submitting ? 'Menyimpan...' : 'Simpan Soal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
