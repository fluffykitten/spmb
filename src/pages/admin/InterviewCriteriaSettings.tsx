import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, GripVertical, BookOpen, Save, X, HelpCircle } from 'lucide-react';

interface Criteria {
    id: string;
    name: string;
    description: string;
    weight: number;
    scoring_rubric: string;
    sort_order: number;
    is_active: boolean;
}

interface Question {
    id: string;
    criteria_id: string;
    question_text: string;
    answer_guide: string;
    ai_rubric: string;
    scoring_rubric: string;
    sort_order: number;
    is_active: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
    return localStorage.getItem('auth_token') || '';
}

async function apiFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
            ...options.headers,
        },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

export default function InterviewCriteriaSettings() {
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
    const [editingCriteria, setEditingCriteria] = useState<Criteria | null>(null);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [showNewCriteria, setShowNewCriteria] = useState(false);
    const [showNewQuestion, setShowNewQuestion] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [criteriaRes, questionsRes] = await Promise.all([
                apiFetch('/api/wawancara/criteria/all'),
                apiFetch('/api/wawancara/questions'),
            ]);
            setCriteria(criteriaRes.data || []);
            setQuestions(questionsRes.data || []);
        } catch (err) {
            console.error('Load data error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const toggleExpand = (id: string) => {
        setExpandedCriteria(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleSaveCriteria = async (data: Partial<Criteria>, isNew: boolean) => {
        try {
            if (isNew) {
                await apiFetch('/api/wawancara/criteria', { method: 'POST', body: JSON.stringify(data) });
            } else {
                await apiFetch(`/api/wawancara/criteria/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
            setEditingCriteria(null);
            setShowNewCriteria(false);
            await loadData();
        } catch (err) {
            console.error('Save criteria error:', err);
        }
    };

    const handleDeleteCriteria = async (id: string) => {
        if (!confirm('Hapus kriteria ini beserta semua pertanyaan di dalamnya?')) return;
        try {
            await apiFetch(`/api/wawancara/criteria/${id}`, { method: 'DELETE' });
            await loadData();
        } catch (err) {
            console.error('Delete criteria error:', err);
        }
    };

    const handleSaveQuestion = async (data: Partial<Question>, isNew: boolean) => {
        try {
            if (isNew) {
                await apiFetch('/api/wawancara/questions', { method: 'POST', body: JSON.stringify(data) });
            } else {
                await apiFetch(`/api/wawancara/questions/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
            }
            setEditingQuestion(null);
            setShowNewQuestion(null);
            await loadData();
        } catch (err) {
            console.error('Save question error:', err);
        }
    };

    const handleDeleteQuestion = async (id: string) => {
        if (!confirm('Hapus pertanyaan ini?')) return;
        try {
            await apiFetch(`/api/wawancara/questions/${id}`, { method: 'DELETE' });
            await loadData();
        } catch (err) {
            console.error('Delete question error:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Pengaturan Kriteria Wawancara</h1>
                    <p className="text-gray-500 mt-1">Kelola kriteria penilaian dan bank pertanyaan</p>
                </div>
                <button
                    onClick={() => setShowNewCriteria(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Kriteria
                </button>
            </div>

            {/* New Criteria Form */}
            {showNewCriteria && (
                <CriteriaForm
                    onSave={(data) => handleSaveCriteria(data, true)}
                    onCancel={() => setShowNewCriteria(false)}
                    nextOrder={criteria.length + 1}
                />
            )}

            {/* Criteria List */}
            <div className="space-y-3">
                {criteria.map((c) => {
                    const criteriaQuestions = questions.filter(q => q.criteria_id === c.id);
                    const isExpanded = expandedCriteria.has(c.id);

                    return (
                        <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {editingCriteria?.id === c.id ? (
                                <CriteriaForm
                                    criteria={c}
                                    onSave={(data) => handleSaveCriteria(data, false)}
                                    onCancel={() => setEditingCriteria(null)}
                                />
                            ) : (
                                <>
                                    <div
                                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => toggleExpand(c.id)}
                                    >
                                        <GripVertical className="w-4 h-4 text-gray-300" />
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        )}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-800">{c.name}</h3>
                                                {!c.is_active && (
                                                    <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Nonaktif</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full font-medium">
                                                Bobot: {c.weight}/10
                                            </span>
                                            <span className="text-gray-400">
                                                {criteriaQuestions.length} pertanyaan
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                            <button className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500" onClick={() => setEditingCriteria(c)}>
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => handleDeleteCriteria(c.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Questions Section */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 bg-gray-50 p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-sm font-medium text-gray-600 flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4" />
                                                    Bank Pertanyaan
                                                </h4>
                                                <button
                                                    onClick={() => setShowNewQuestion(c.id)}
                                                    className="text-xs flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Tambah Pertanyaan
                                                </button>
                                            </div>

                                            {showNewQuestion === c.id && (
                                                <QuestionForm
                                                    criteriaId={c.id}
                                                    onSave={(data) => handleSaveQuestion(data, true)}
                                                    onCancel={() => setShowNewQuestion(null)}
                                                    nextOrder={criteriaQuestions.length + 1}
                                                />
                                            )}

                                            {criteriaQuestions.length === 0 && !showNewQuestion ? (
                                                <p className="text-sm text-gray-400 text-center py-4">Belum ada pertanyaan</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {criteriaQuestions.map((q, idx) => (
                                                        editingQuestion?.id === q.id ? (
                                                            <QuestionForm
                                                                key={q.id}
                                                                question={q}
                                                                criteriaId={c.id}
                                                                onSave={(data) => handleSaveQuestion(data, false)}
                                                                onCancel={() => setEditingQuestion(null)}
                                                            />
                                                        ) : (
                                                            <div key={q.id} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors">
                                                                <div className="flex items-start gap-3">
                                                                    <span className="text-xs font-mono text-gray-400 mt-0.5">{idx + 1}.</span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm text-gray-700 font-medium">{q.question_text}</p>
                                                                        {q.answer_guide && (
                                                                            <div className="flex items-start gap-1.5 mt-1.5">
                                                                                <HelpCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                                                                <p className="text-xs text-gray-500">{q.answer_guide}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                                        <button className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500" onClick={() => setEditingQuestion(q)}>
                                                                            <Edit2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => handleDeleteQuestion(q.id)}>
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {criteria.length === 0 && !showNewCriteria && (
                <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-500">Belum ada kriteria</h3>
                    <p className="text-sm text-gray-400 mt-1">Tambahkan kriteria penilaian untuk memulai</p>
                    <button
                        onClick={() => setShowNewCriteria(true)}
                        className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
                    >
                        <Plus className="w-4 h-4 inline mr-1" /> Tambah Kriteria Pertama
                    </button>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Criteria Form
// ============================================================
function CriteriaForm({ criteria, onSave, onCancel, nextOrder }: {
    criteria?: Criteria;
    onSave: (data: Partial<Criteria>) => void;
    onCancel: () => void;
    nextOrder?: number;
}) {
    const [name, setName] = useState(criteria?.name || '');
    const [description, setDescription] = useState(criteria?.description || '');
    const [weight, setWeight] = useState(criteria?.weight || 5);
    const [scoringRubric, setScoringRubric] = useState(criteria?.scoring_rubric || '');
    const [isActive, setIsActive] = useState(criteria?.is_active ?? true);

    return (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-3">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nama Kriteria</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="Contoh: Motivasi Belajar"
                    />
                </div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Bobot (1-10)</label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={weight}
                            onChange={(e) => setWeight(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                            Aktif
                        </label>
                    </div>
                </div>
            </div>
            <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Deskripsi</label>
                <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Deskripsi singkat tentang kriteria ini"
                />
            </div>
            <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Rubrik Penilaian (opsional)</label>
                <textarea
                    value={scoringRubric}
                    onChange={(e) => setScoringRubric(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Skor 1: Kurang&#10;Skor 2: Cukup&#10;Skor 3: Baik&#10;Skor 4: Sangat Baik&#10;Skor 5: Istimewa"
                />
            </div>
            <div className="flex justify-end gap-2 mt-3">
                <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-4 h-4 inline mr-1" /> Batal
                </button>
                <button
                    onClick={() => onSave({
                        ...(criteria ? { id: criteria.id } : {}),
                        name, description, weight, scoring_rubric: scoringRubric,
                        sort_order: criteria?.sort_order || nextOrder || 0,
                        is_active: isActive
                    })}
                    disabled={!name.trim()}
                    className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                    <Save className="w-4 h-4 inline mr-1" /> Simpan
                </button>
            </div>
        </div>
    );
}

// ============================================================
// Question Form
// ============================================================
function QuestionForm({ question, criteriaId, onSave, onCancel, nextOrder }: {
    question?: Question;
    criteriaId: string;
    onSave: (data: Partial<Question>) => void;
    onCancel: () => void;
    nextOrder?: number;
}) {
    const [questionText, setQuestionText] = useState(question?.question_text || '');
    const [answerGuide, setAnswerGuide] = useState(question?.answer_guide || '');
    const [scoringRubric, setScoringRubric] = useState(question?.scoring_rubric || '');
    const [aiRubric, setAiRubric] = useState(question?.ai_rubric || '');

    return (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-2">
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pertanyaan</label>
                <input
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Tuliskan pertanyaan..."
                />
            </div>
            <div className="mt-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Panduan Jawaban</label>
                <textarea
                    value={answerGuide}
                    onChange={(e) => setAnswerGuide(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Panduan untuk pewawancara tentang jawaban ideal"
                />
            </div>
            <div className="mt-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Rubrik Penilaian (opsional)</label>
                <textarea
                    value={scoringRubric}
                    onChange={(e) => setScoringRubric(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Rubrik penilaian per skor 1-5"
                />
            </div>
            <div className="mt-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">AI Rubrik (opsional)</label>
                <textarea
                    value={aiRubric}
                    onChange={(e) => setAiRubric(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Instruksi khusus untuk AI dalam mengevaluasi jawaban"
                />
            </div>
            <div className="flex justify-end gap-2 mt-2">
                <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
                <button
                    onClick={() => onSave({
                        ...(question ? { id: question.id } : {}),
                        criteria_id: criteriaId,
                        question_text: questionText,
                        answer_guide: answerGuide,
                        ai_rubric: aiRubric,
                        scoring_rubric: scoringRubric,
                        sort_order: question?.sort_order || nextOrder || 0,
                        is_active: question?.is_active ?? true,
                    })}
                    disabled={!questionText.trim()}
                    className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                    Simpan
                </button>
            </div>
        </div>
    );
}
