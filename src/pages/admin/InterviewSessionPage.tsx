import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StarRating from '../../components/shared/StarRating';
import AutosaveIndicator from '../../components/shared/AutosaveIndicator';
import { useAutosave } from '../../hooks/useAutosave';
import {
    Save, CheckCircle2, ChevronDown, ChevronRight, Loader2, BookOpen,
    ArrowLeft, FileText, User, Calendar, Video, ExternalLink
} from 'lucide-react';

interface Criteria {
    id: string; name: string; description: string; weight: number;
    sort_order: number; scoring_rubric: string;
}

interface Question {
    id: string; criteria_id: string; question_text: string;
    answer_guide: string; sort_order: number;
}

interface CriteriaSection {
    criteria: Criteria;
    questions: Question[];
    expanded: boolean;
}

interface AutosaveData {
    candidate_name: string;
    candidate_registration_no: string;
    candidate_origin_school: string;
    candidate_birth_date: string;
    candidate_parent_name: string;
    general_notes: string;
    scores: Record<string, { score: number; notes: string }>;
    question_scores: Record<string, number>;
    notes: Record<string, { question_text: string; answer_text: string }>;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() { return localStorage.getItem('auth_token') || ''; }

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

export default function InterviewSessionPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [interviewId, setInterviewId] = useState<string | null>(id || null);
    const [sections, setSections] = useState<CriteriaSection[]>([]);

    // Candidate info
    const [candidateName, setCandidateName] = useState('');
    const [candidateRegNo, setCandidateRegNo] = useState('');
    const [candidateSchool, setCandidateSchool] = useState('');
    const [candidateBirthDate, setCandidateBirthDate] = useState('');
    const [candidateParent, setCandidateParent] = useState('');
    const [generalNotes, setGeneralNotes] = useState('');
    const [meetingLink, setMeetingLink] = useState<string | null>(null);

    // Scores and notes
    const [scores, setScores] = useState<Record<string, { score: number; notes: string }>>({});
    const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
    const [questionNotes, setQuestionNotes] = useState<Record<string, { question_text: string; answer_text: string }>>({});

    const autosaveData: AutosaveData = {
        candidate_name: candidateName,
        candidate_registration_no: candidateRegNo,
        candidate_origin_school: candidateSchool,
        candidate_birth_date: candidateBirthDate,
        candidate_parent_name: candidateParent,
        general_notes: generalNotes,
        scores,
        question_scores: questionScores,
        notes: questionNotes,
    };

    const handleAutosave = useCallback(async (data: unknown) => {
        if (!interviewId) return;
        const d = data as AutosaveData;
        await apiFetch(`/api/wawancara/interviews/${interviewId}`, {
            method: 'PUT',
            body: JSON.stringify({
                candidate_name: d.candidate_name,
                candidate_registration_no: d.candidate_registration_no,
                candidate_origin_school: d.candidate_origin_school,
                candidate_birth_date: d.candidate_birth_date || null,
                candidate_parent_name: d.candidate_parent_name,
                general_notes: d.general_notes,
                status: 'in_progress',
                autosave_data: d,
            }),
        });
    }, [interviewId]);

    const { status: autosaveStatus } = useAutosave({
        data: autosaveData,
        onSave: handleAutosave,
        enabled: !!interviewId,
        interval: 3000,
    });

    useEffect(() => {
        loadInitialData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    async function loadInitialData() {
        try {
            setLoading(true);
            // Load criteria and questions
            const [criteriaRes, questionsRes] = await Promise.all([
                apiFetch('/api/wawancara/criteria'),
                apiFetch('/api/wawancara/questions'),
            ]);

            const criteriaList = criteriaRes.data || [];
            const questionList = questionsRes.data || [];

            const newSections: CriteriaSection[] = criteriaList.map((c: Criteria) => ({
                criteria: c,
                questions: questionList.filter((q: Question) => q.criteria_id === c.id),
                expanded: true,
            }));
            setSections(newSections);

            // Load existing interview if editing
            if (id) {
                const interviewRes = await apiFetch(`/api/wawancara/interviews/${id}`);
                const interview = interviewRes.data;
                if (interview) {
                    setCandidateName(interview.candidate_name || '');
                    setCandidateRegNo(interview.candidate_registration_no || '');
                    setCandidateSchool(interview.candidate_origin_school || '');
                    setCandidateBirthDate(interview.candidate_birth_date?.split('T')[0] || '');
                    setCandidateParent(interview.candidate_parent_name || '');
                    setGeneralNotes(interview.general_notes || '');

                    // Restore autosave data or saved scores
                    if (interview.autosave_data) {
                        const ad = interview.autosave_data;
                        if (ad.scores) setScores(ad.scores);
                        if (ad.question_scores) setQuestionScores(ad.question_scores);
                        if (ad.notes) setQuestionNotes(ad.notes);
                    } else {
                        // Build from saved scores
                        const scoreMap: Record<string, { score: number; notes: string }> = {};
                        for (const s of interview.scores || []) {
                            scoreMap[s.criteria_id] = { score: s.score, notes: s.notes };
                        }
                        setScores(scoreMap);

                        const noteMap: Record<string, { question_text: string; answer_text: string }> = {};
                        for (const n of interview.notes || []) {
                            if (n.question_id) {
                                noteMap[n.question_id] = { question_text: n.question_text, answer_text: n.answer_text };
                            }
                        }
                        setQuestionNotes(noteMap);
                    }

                    // Load meeting link from interview_requests if linked
                    if (interview.applicant_id) {
                        try {
                            const irRes = await fetch(`${API_BASE}/api/data/query`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                                body: JSON.stringify({
                                    table: 'interview_requests',
                                    select: 'meeting_link, proposed_type',
                                    filters: [{ column: 'applicant_id', op: 'eq', value: interview.applicant_id }, { column: 'status', op: 'eq', value: 'approved' }],
                                    limit: 1
                                })
                            });
                            const irData = await irRes.json();
                            if (irData.data?.[0]?.meeting_link) {
                                setMeetingLink(irData.data[0].meeting_link);
                            }
                        } catch (e) {
                            console.warn('Could not load meeting link:', e);
                        }
                    }
                }
            } else {
                // Create new interview
                const newRes = await apiFetch('/api/wawancara/interviews', {
                    method: 'POST',
                    body: JSON.stringify({}),
                });
                setInterviewId(newRes.data.id);
            }
        } catch (err) {
            console.error('Load data error:', err);
        } finally {
            setLoading(false);
        }
    }

    function toggleSection(idx: number) {
        setSections(prev => prev.map((s, i) => i === idx ? { ...s, expanded: !s.expanded } : s));
    }

    function updateScore(criteriaId: string, score: number) {
        setScores(prev => ({
            ...prev,
            [criteriaId]: { ...(prev[criteriaId] || { score: 0, notes: '' }), score }
        }));
    }

    function updateScoreNotes(criteriaId: string, notes: string) {
        setScores(prev => ({
            ...prev,
            [criteriaId]: { ...(prev[criteriaId] || { score: 0, notes: '' }), notes }
        }));
    }

    function updateQuestionNote(questionId: string, questionText: string, answerText: string) {
        setQuestionNotes(prev => ({
            ...prev,
            [questionId]: { question_text: questionText, answer_text: answerText }
        }));
    }

    function handleQuestionScore(questionId: string, score: number) {
        setQuestionScores(prev => ({ ...prev, [questionId]: score }));
    }

    async function handleManualSave() {
        if (!interviewId) return;
        setSaving(true);
        try {
            await handleAutosave(autosaveData);
        } finally {
            setSaving(false);
        }
    }

    async function handleFinalize() {
        if (!interviewId) return;
        if (!confirm('Finalisasi wawancara? Skor akhir akan dihitung dan disimpan.')) return;

        setSaving(true);
        try {
            // Save all scores first
            const scoreArray = Object.entries(scores).map(([criteria_id, { score, notes }]) => ({
                criteria_id, score, notes
            }));
            if (scoreArray.length > 0) {
                await apiFetch(`/api/wawancara/interviews/${interviewId}/scores`, {
                    method: 'POST',
                    body: JSON.stringify({ scores: scoreArray }),
                });
            }

            // Save all notes
            const noteArray = Object.entries(questionNotes).map(([question_id, { question_text, answer_text }]) => ({
                question_id, question_text, answer_text
            }));
            if (noteArray.length > 0) {
                await apiFetch(`/api/wawancara/interviews/${interviewId}/notes`, {
                    method: 'POST',
                    body: JSON.stringify({ notes: noteArray }),
                });
            }

            // Finalize
            await apiFetch(`/api/wawancara/interviews/${interviewId}/finalize`, {
                method: 'POST',
                body: JSON.stringify({ final_recommendation: '' }),
            });

            navigate(`/admin/interview-session/${interviewId}/report`);
        } catch (err) {
            console.error('Finalize error:', err);
            alert('Gagal menyelesaikan wawancara');
        } finally {
            setSaving(false);
        }
    }

    // Calculate live preview
    const previewScore = (() => {
        const scored = Object.values(scores).filter(s => s.score > 0);
        if (scored.length === 0) return 0;
        let totalWeight = 0, weightedSum = 0;
        for (const [criteriaId, { score }] of Object.entries(scores)) {
            if (score === 0) continue;
            const section = sections.find(s => s.criteria.id === criteriaId);
            if (!section) continue;
            weightedSum += score * section.criteria.weight;
            totalWeight += section.criteria.weight;
        }
        return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
    })();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin/interview-list')} className="p-2 rounded-lg hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">
                            {id ? 'Lanjutkan Wawancara' : 'Wawancara Baru'}
                        </h1>
                        <div className="flex items-center gap-3 mt-1">
                            <AutosaveIndicator status={autosaveStatus} />
                            {previewScore > 0 && (
                                <span className="text-sm font-medium text-teal-600">
                                    Skor: {previewScore.toFixed(2)}/5.00
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleManualSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" /> Simpan
                    </button>
                    <button
                        onClick={handleFinalize}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                    >
                        <CheckCircle2 className="w-4 h-4" /> Selesaikan
                    </button>
                </div>
            </div>

            {/* Candidate Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                    <User className="w-4 h-4" /> Data Kandidat
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Nama Lengkap</label>
                        <input
                            value={candidateName}
                            onChange={(e) => setCandidateName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500"
                            placeholder="Nama kandidat"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">No. Pendaftaran</label>
                        <input
                            value={candidateRegNo}
                            onChange={(e) => setCandidateRegNo(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500"
                            placeholder="Nomor pendaftaran"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Asal Sekolah</label>
                        <input
                            value={candidateSchool}
                            onChange={(e) => setCandidateSchool(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500"
                            placeholder="Asal sekolah"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Tanggal Lahir
                        </label>
                        <input
                            type="date"
                            value={candidateBirthDate}
                            onChange={(e) => setCandidateBirthDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Nama Orang Tua/Wali</label>
                        <input
                            value={candidateParent}
                            onChange={(e) => setCandidateParent(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500"
                            placeholder="Nama orang tua/wali"
                        />
                    </div>
                    {meetingLink && (
                        <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <Video className="w-3 h-3" /> Link Meeting (Online)
                            </label>
                            <a
                                href={meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                {meetingLink}
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* Criteria Sections */}
            <div className="space-y-4">
                {sections.map((section, idx) => {
                    const criteriaScore = scores[section.criteria.id]?.score || 0;
                    return (
                        <div key={section.criteria.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Section Header */}
                            <div
                                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleSection(idx)}
                            >
                                {section.expanded ? (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                )}
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-800">{section.criteria.name}</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">{section.criteria.description}</p>
                                </div>
                                <span className="text-xs bg-teal-50 text-teal-600 px-2 py-1 rounded-full">
                                    Bobot: {section.criteria.weight}
                                </span>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <StarRating value={criteriaScore} onChange={(v) => updateScore(section.criteria.id, v)} />
                                </div>
                            </div>

                            {/* Section Content */}
                            {section.expanded && (
                                <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                                    {/* Scoring Rubric */}
                                    {section.criteria.scoring_rubric && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                                            <strong className="block mb-1">📋 Rubrik Penilaian:</strong>
                                            <pre className="whitespace-pre-wrap font-sans">{section.criteria.scoring_rubric}</pre>
                                        </div>
                                    )}

                                    {/* Score Notes */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Catatan Kriteria</label>
                                        <textarea
                                            value={scores[section.criteria.id]?.notes || ''}
                                            onChange={(e) => updateScoreNotes(section.criteria.id, e.target.value)}
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500"
                                            placeholder="Catatan untuk kriteria ini..."
                                        />
                                    </div>

                                    {/* Questions */}
                                    {section.questions.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                                                <BookOpen className="w-3.5 h-3.5" /> Pertanyaan
                                            </h4>
                                            <div className="space-y-2">
                                                {section.questions.map((q, qIdx) => (
                                                    <div key={q.id} className="bg-white rounded-lg border border-gray-200 p-3">
                                                        <div className="flex items-start gap-2 mb-2">
                                                            <span className="text-xs font-mono text-gray-400 mt-0.5">{qIdx + 1}.</span>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium text-gray-700">{q.question_text}</p>
                                                                {q.answer_guide && (
                                                                    <p className="text-xs text-gray-400 mt-0.5 italic">💡 {q.answer_guide}</p>
                                                                )}
                                                            </div>
                                                            <div className="flex-shrink-0">
                                                                <StarRating
                                                                    value={questionScores[q.id] || 0}
                                                                    onChange={(v) => handleQuestionScore(q.id, v)}
                                                                    size="sm"
                                                                    showLabel={false}
                                                                />
                                                            </div>
                                                        </div>
                                                        <textarea
                                                            value={questionNotes[q.id]?.answer_text || ''}
                                                            onChange={(e) => updateQuestionNote(q.id, q.question_text, e.target.value)}
                                                            rows={2}
                                                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-teal-500"
                                                            placeholder="Catat jawaban kandidat..."
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* General Notes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mt-6">
                <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Catatan Umum
                </h2>
                <textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500"
                    placeholder="Catatan umum tentang wawancara..."
                />
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-between mt-6 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                    <AutosaveIndicator status={autosaveStatus} />
                    <span className="text-sm text-gray-500">
                        {Object.values(scores).filter(s => s.score > 0).length} / {sections.length} kriteria dinilai
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {previewScore > 0 && (
                        <div className="text-right mr-4">
                            <div className="text-xs text-gray-400">Skor Sementara</div>
                            <div className="text-xl font-bold text-teal-600">{previewScore.toFixed(2)}</div>
                        </div>
                    )}
                    <button
                        onClick={handleManualSave}
                        disabled={saving}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                        Simpan Draft
                    </button>
                    <button
                        onClick={handleFinalize}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
                    >
                        <CheckCircle2 className="w-4 h-4" /> Selesaikan Wawancara
                    </button>
                </div>
            </div>
        </div>
    );
}
