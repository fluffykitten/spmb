export interface Criteria {
    id: string;
    name: string;
    description: string;
    weight: number;
    scoring_rubric: string;
    sort_order: number;
    is_active: boolean;
    created_at: string;
}

export interface InterviewScore {
    id: string;
    interview_id: string;
    criteria_id: string;
    score: number;
    notes: string;
    created_at: string;
    criteria?: Criteria;
}

export interface RecommendationThreshold {
    min_score: number;
    label: string;
    color: string;
}

export function calculateWeightedScore(
    scores: InterviewScore[],
    criteriaList: Criteria[]
): { totalScore: number; weightedScore: number } {
    if (scores.length === 0 || criteriaList.length === 0) {
        return { totalScore: 0, weightedScore: 0 };
    }

    const criteriaMap = new Map(criteriaList.map((c) => [c.id, c]));
    let totalWeight = 0;
    let weightedSum = 0;
    let rawSum = 0;
    let count = 0;

    for (const score of scores) {
        if (score.score === 0) continue;
        const criteria = criteriaMap.get(score.criteria_id);
        if (!criteria) continue;
        rawSum += score.score;
        weightedSum += score.score * criteria.weight;
        totalWeight += criteria.weight;
        count++;
    }

    const totalScore = count > 0 ? rawSum / count : 0;
    const weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
        totalScore: Math.round(totalScore * 100) / 100,
        weightedScore: Math.round(weightedScore * 100) / 100,
    };
}

const DEFAULT_THRESHOLDS: RecommendationThreshold[] = [
    { min_score: 4.0, label: 'Sangat Direkomendasikan', color: '#059669' },
    { min_score: 3.0, label: 'Direkomendasikan', color: '#0284c7' },
    { min_score: 2.0, label: 'Perlu Pertimbangan', color: '#d97706' },
    { min_score: 0, label: 'Tidak Direkomendasikan', color: '#dc2626' },
];

export function getRecommendation(
    weightedScore: number,
    thresholds?: RecommendationThreshold[]
): RecommendationThreshold {
    const sorted = [...(thresholds || DEFAULT_THRESHOLDS)].sort((a, b) => b.min_score - a.min_score);
    for (const t of sorted) {
        if (weightedScore >= t.min_score) return t;
    }
    return sorted[sorted.length - 1] || { min_score: 0, label: 'Tidak Direkomendasikan', color: '#dc2626' };
}

export function getStrengthsAndWeaknesses(
    scores: InterviewScore[],
    criteriaList: Criteria[]
) {
    const criteriaMap = new Map(criteriaList.map((c) => [c.id, c]));
    const scored = scores
        .filter((s) => s.score > 0)
        .map((s) => ({
            ...s,
            criteriaName: criteriaMap.get(s.criteria_id)?.name || '',
        }))
        .sort((a, b) => b.score - a.score);

    return {
        strengths: scored.slice(0, 3),
        weaknesses: scored.slice(-3).reverse(),
    };
}
