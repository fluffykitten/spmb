import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StarRating from '../../components/shared/StarRating';
import { calculateWeightedScore, getRecommendation, getStrengthsAndWeaknesses } from '../../lib/scoring';
import type { Criteria, InterviewScore } from '../../lib/scoring';
import { ArrowLeft, Printer, TrendingUp, TrendingDown, FileText, User, Calendar, Download, Loader2 } from 'lucide-react';
import { generateInterviewReportPDF } from '../../lib/interviewReportPdf';

interface Interview {
    id: string;
    candidate_name: string;
    candidate_registration_no: string;
    candidate_origin_school: string;
    candidate_birth_date: string | null;
    candidate_parent_name: string;
    status: string;
    general_notes: string;
    final_recommendation: string;
    total_score: number;
    weighted_score: number;
    interviewer_name: string;
    created_at: string;
    updated_at: string;
    scores: InterviewScore[];
    notes: { question_id: string; question_text: string; answer_text: string }[];
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() { return localStorage.getItem('auth_token') || ''; }

async function apiFetch(path: string) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

export default function InterviewReportPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [interview, setInterview] = useState<Interview | null>(null);
    const [criteria, setCriteria] = useState<Criteria[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    useEffect(() => {
        loadReport();
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    async function loadReport() {
        try {
            setLoading(true);
            const [interviewRes, criteriaRes] = await Promise.all([
                apiFetch(`/api/wawancara/interviews/${id}`),
                apiFetch('/api/wawancara/criteria'),
            ]);
            setInterview(interviewRes.data);
            setCriteria(criteriaRes.data || []);
        } catch (err) {
            console.error('Load report error:', err);
        } finally {
            setLoading(false);
        }
    }

    const handleDownloadPDF = async () => {
        if (!interview) return;
        setGeneratingPdf(true);
        try {
            const scoresByCriteria = new Map(
                (interview.scores || []).map((s) => [s.criteria_id, s])
            );

            await generateInterviewReportPDF({
                candidateName: interview.candidate_name,
                registrationNumber: interview.candidate_registration_no,
                originSchool: interview.candidate_origin_school,
                birthDate: interview.candidate_birth_date,
                parentName: interview.candidate_parent_name,
                interviewerName: interview.interviewer_name,
                interviewDate: interview.updated_at,
                generalNotes: interview.general_notes || '',
                totalScore: interview.total_score,
                weightedScore: interview.weighted_score,
                finalRecommendation: interview.final_recommendation || '',
                scores: criteria.map(c => {
                    const s = scoresByCriteria.get(c.id);
                    return {
                        criteriaName: c.name,
                        criteriaWeight: c.weight,
                        score: s?.score || 0,
                        notes: s?.notes || ''
                    };
                }),
                questionNotes: (interview.notes || [])
                    .filter(n => n.answer_text?.trim())
                    .map(n => ({ questionText: n.question_text, answerText: n.answer_text }))
            });
        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Gagal membuat PDF');
        } finally {
            setGeneratingPdf(false);
        }
    };

    if (loading || !interview) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    const { totalScore, weightedScore } = calculateWeightedScore(interview.scores || [], criteria);
    const recommendation = getRecommendation(weightedScore);
    const { strengths, weaknesses } = getStrengthsAndWeaknesses(interview.scores || [], criteria);

    const scoresByCriteria = new Map(
        (interview.scores || []).map((s) => [s.criteria_id, s])
    );

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header - Non-printable */}
            <div className="flex items-center justify-between mb-6 print:hidden">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                    <ArrowLeft className="w-5 h-5" /> Kembali
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={generatingPdf}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {generatingPdf ? 'Membuat PDF...' : 'Download PDF'}
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                        <Printer className="w-4 h-4" /> Cetak
                    </button>
                </div>
            </div>

            {/* Report Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-0">
                {/* Title */}
                <div className="p-6 border-b border-gray-100 text-center">
                    <h1 className="text-2xl font-bold text-gray-800">Laporan Hasil Wawancara</h1>
                    <p className="text-gray-500 mt-1">Penerimaan Peserta Didik Baru</p>
                </div>

                {/* Candidate Info */}
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" /> Data Kandidat
                    </h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">Nama:</span> <strong>{interview.candidate_name || '-'}</strong></div>
                        <div><span className="text-gray-500">No. Pendaftaran:</span> <strong>{interview.candidate_registration_no || '-'}</strong></div>
                        <div><span className="text-gray-500">Asal Sekolah:</span> <strong>{interview.candidate_origin_school || '-'}</strong></div>
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-gray-500">Tanggal Lahir:</span>{' '}
                            <strong>{interview.candidate_birth_date ? new Date(interview.candidate_birth_date).toLocaleDateString('id-ID') : '-'}</strong>
                        </div>
                        <div><span className="text-gray-500">Orang Tua/Wali:</span> <strong>{interview.candidate_parent_name || '-'}</strong></div>
                        <div><span className="text-gray-500">Pewawancara:</span> <strong>{interview.interviewer_name || '-'}</strong></div>
                    </div>
                </div>

                {/* Score Summary */}
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-gray-600 mb-1">Skor Akhir</h2>
                            <div className="flex items-baseline gap-3">
                                <span className="text-4xl font-bold" style={{ color: recommendation.color }}>
                                    {weightedScore.toFixed(2)}
                                </span>
                                <span className="text-gray-400 text-lg">/ 5.00</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">Rata-rata: {totalScore.toFixed(2)}</p>
                        </div>
                        <div
                            className="px-6 py-3 rounded-xl text-white font-bold text-lg"
                            style={{ backgroundColor: recommendation.color }}
                        >
                            {recommendation.label}
                        </div>
                    </div>
                </div>

                {/* Strengths & Weaknesses */}
                {(strengths.length > 0 || weaknesses.length > 0) && (
                    <div className="p-6 border-b border-gray-100 grid grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-sm font-bold text-green-600 mb-2 flex items-center gap-1.5">
                                <TrendingUp className="w-4 h-4" /> Kekuatan
                            </h3>
                            <div className="space-y-1.5">
                                {strengths.map((s) => (
                                    <div key={s.criteria_id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                                        <span className="text-sm text-gray-700">{s.criteriaName}</span>
                                        <StarRating value={s.score} readonly size="sm" showLabel={false} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-red-500 mb-2 flex items-center gap-1.5">
                                <TrendingDown className="w-4 h-4" /> Perlu Peningkatan
                            </h3>
                            <div className="space-y-1.5">
                                {weaknesses.map((s) => (
                                    <div key={s.criteria_id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                                        <span className="text-sm text-gray-700">{s.criteriaName}</span>
                                        <StarRating value={s.score} readonly size="sm" showLabel={false} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Detailed Scores */}
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-sm font-bold text-gray-600 mb-3">Detail Penilaian Per Kriteria</h2>
                    <div className="space-y-3">
                        {criteria.map((c) => {
                            const score = scoresByCriteria.get(c.id);
                            return (
                                <div key={c.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <h3 className="font-medium text-gray-800">{c.name}</h3>
                                            <p className="text-xs text-gray-400">{c.description} • Bobot: {c.weight}</p>
                                        </div>
                                        <StarRating value={score?.score || 0} readonly />
                                    </div>
                                    {score?.notes && (
                                        <div className="mt-2 bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                                            <strong className="text-xs text-gray-500">Catatan:</strong> {score.notes}
                                        </div>
                                    )}

                                    {/* Notes for this criteria's questions */}
                                    {interview.notes?.filter(n => {
                                        // Show notes that have answer text
                                        return n.answer_text && n.answer_text.trim();
                                    }).length > 0 && (
                                            <div className="mt-2 space-y-1.5">
                                                {interview.notes.filter(n => n.answer_text?.trim()).map((note, idx) => (
                                                    <div key={idx} className="text-xs bg-gray-50 rounded p-2">
                                                        <span className="text-gray-500">Q: {note.question_text}</span>
                                                        <p className="text-gray-700 mt-0.5">A: {note.answer_text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* General Notes */}
                {interview.general_notes && (
                    <div className="p-6">
                        <h2 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Catatan Umum
                        </h2>
                        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                            {interview.general_notes}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 text-center text-xs text-gray-400">
                    Laporan dibuat pada {new Date(interview.updated_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                </div>
            </div>
        </div>
    );
}
