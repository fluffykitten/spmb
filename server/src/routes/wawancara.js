import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================
// CRITERIA
// ============================================================

// GET /api/wawancara/criteria
router.get('/criteria', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM wawancara_criteria WHERE is_active = true ORDER BY sort_order ASC'
        );
        res.json({ data: rows, error: null });
    } catch (err) {
        console.error('Get criteria error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// GET /api/wawancara/criteria/all (including inactive)
router.get('/criteria/all', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM wawancara_criteria ORDER BY sort_order ASC'
        );
        res.json({ data: rows, error: null });
    } catch (err) {
        console.error('Get all criteria error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// POST /api/wawancara/criteria
router.post('/criteria', async (req, res) => {
    try {
        const { name, description, weight, scoring_rubric, sort_order, is_active } = req.body;
        const { rows } = await pool.query(
            `INSERT INTO wawancara_criteria (name, description, weight, scoring_rubric, sort_order, is_active)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, description || '', weight || 5, scoring_rubric || '', sort_order || 0, is_active !== false]
        );
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Create criteria error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// PUT /api/wawancara/criteria/:id
router.put('/criteria/:id', async (req, res) => {
    try {
        const { name, description, weight, scoring_rubric, sort_order, is_active } = req.body;
        const { rows } = await pool.query(
            `UPDATE wawancara_criteria SET name = $1, description = $2, weight = $3, 
             scoring_rubric = $4, sort_order = $5, is_active = $6 WHERE id = $7 RETURNING *`,
            [name, description, weight, scoring_rubric, sort_order, is_active, req.params.id]
        );
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Update criteria error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// DELETE /api/wawancara/criteria/:id
router.delete('/criteria/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM wawancara_criteria WHERE id = $1', [req.params.id]);
        res.json({ data: { success: true }, error: null });
    } catch (err) {
        console.error('Delete criteria error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// ============================================================
// QUESTIONS
// ============================================================

// GET /api/wawancara/questions?criteria_id=xxx
router.get('/questions', async (req, res) => {
    try {
        const { criteria_id } = req.query;
        let sql = 'SELECT * FROM wawancara_question_bank';
        const params = [];
        if (criteria_id) {
            sql += ' WHERE criteria_id = $1';
            params.push(criteria_id);
        }
        sql += ' ORDER BY sort_order ASC';
        const { rows } = await pool.query(sql, params);
        res.json({ data: rows, error: null });
    } catch (err) {
        console.error('Get questions error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// POST /api/wawancara/questions
router.post('/questions', async (req, res) => {
    try {
        const { criteria_id, question_text, answer_guide, ai_rubric, scoring_rubric, sort_order, is_active } = req.body;
        const { rows } = await pool.query(
            `INSERT INTO wawancara_question_bank (criteria_id, question_text, answer_guide, ai_rubric, scoring_rubric, sort_order, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [criteria_id, question_text, answer_guide || '', ai_rubric || '', scoring_rubric || '', sort_order || 0, is_active !== false]
        );
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Create question error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// PUT /api/wawancara/questions/:id
router.put('/questions/:id', async (req, res) => {
    try {
        const { criteria_id, question_text, answer_guide, ai_rubric, scoring_rubric, sort_order, is_active } = req.body;
        const { rows } = await pool.query(
            `UPDATE wawancara_question_bank SET criteria_id = $1, question_text = $2, answer_guide = $3, 
             ai_rubric = $4, scoring_rubric = $5, sort_order = $6, is_active = $7 WHERE id = $8 RETURNING *`,
            [criteria_id, question_text, answer_guide, ai_rubric, scoring_rubric, sort_order, is_active, req.params.id]
        );
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Update question error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// DELETE /api/wawancara/questions/:id
router.delete('/questions/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM wawancara_question_bank WHERE id = $1', [req.params.id]);
        res.json({ data: { success: true }, error: null });
    } catch (err) {
        console.error('Delete question error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// ============================================================
// INTERVIEWS
// ============================================================

// GET /api/wawancara/interviews
router.get('/interviews', async (req, res) => {
    try {
        const { academic_year_id } = req.query;
        let queryStr = `
            SELECT wi.*, p.full_name as interviewer_name, p.email as interviewer_email
            FROM wawancara_interviews wi
            LEFT JOIN profiles p ON p.user_id = wi.interviewer_id
        `;
        const params = [];
        if (academic_year_id) {
            queryStr += ` WHERE wi.academic_year_id = $1`;
            params.push(academic_year_id);
        }
        queryStr += ` ORDER BY wi.updated_at DESC`;

        const { rows } = await pool.query(queryStr, params);
        res.json({ data: rows, error: null });
    } catch (err) {
        console.error('Get interviews error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// GET /api/wawancara/interviews/:id (full detail with scores + notes)
router.get('/interviews/:id', async (req, res) => {
    try {
        const { rows: interviews } = await pool.query(
            `SELECT wi.*, p.full_name as interviewer_name 
             FROM wawancara_interviews wi 
             LEFT JOIN profiles p ON p.user_id = wi.interviewer_id 
             WHERE wi.id = $1`,
            [req.params.id]
        );
        if (!interviews[0]) {
            return res.status(404).json({ data: null, error: 'Interview not found' });
        }

        const { rows: scores } = await pool.query(
            'SELECT * FROM wawancara_scores WHERE interview_id = $1',
            [req.params.id]
        );
        const { rows: notes } = await pool.query(
            'SELECT * FROM wawancara_notes WHERE interview_id = $1',
            [req.params.id]
        );
        const { rows: aiAnalyses } = await pool.query(
            'SELECT * FROM wawancara_ai_analyses WHERE interview_id = $1',
            [req.params.id]
        );

        res.json({
            data: {
                ...interviews[0],
                scores,
                notes,
                ai_analyses: aiAnalyses
            },
            error: null
        });
    } catch (err) {
        console.error('Get interview detail error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// POST /api/wawancara/interviews/from-request (auto-create from approved interview request)
router.post('/interviews/from-request', async (req, res) => {
    try {
        const { applicant_id, interview_request_id } = req.body;
        if (!applicant_id) {
            return res.status(400).json({ data: null, error: 'applicant_id is required' });
        }

        // Check if wawancara interview already exists for this applicant
        const { rows: existing } = await pool.query(
            'SELECT id FROM wawancara_interviews WHERE applicant_id = $1 LIMIT 1',
            [applicant_id]
        );
        if (existing.length > 0) {
            return res.json({ data: existing[0], error: null, message: 'Interview already exists' });
        }

        // Get applicant data
        const { rows: applicants } = await pool.query(
            'SELECT id, dynamic_data, registration_number, academic_year_id FROM applicants WHERE id = $1',
            [applicant_id]
        );
        if (!applicants[0]) {
            return res.status(404).json({ data: null, error: 'Applicant not found' });
        }

        const applicant = applicants[0];
        const dd = applicant.dynamic_data || {};

        // Extract student info from dynamic_data
        const candidateName = dd.nama_lengkap || dd.full_name || '';
        const candidateRegNo = applicant.registration_number || '';
        const candidateSchool = dd.asal_sekolah || dd.sekolah_asal || dd.origin_school || '';
        const candidateBirthDate = dd.tanggal_lahir || dd.birth_date || null;
        const candidateParentName = dd.nama_ayah || dd.nama_orang_tua || dd.nama_wali || dd.parent_name || '';

        // Get meeting link from interview request if provided
        let meetingLink = null;
        if (interview_request_id) {
            const { rows: requests } = await pool.query(
                'SELECT meeting_link, proposed_type FROM interview_requests WHERE id = $1',
                [interview_request_id]
            );
            if (requests[0] && requests[0].proposed_type === 'online') {
                meetingLink = requests[0].meeting_link;
            }
        }

        // Create wawancara interview record
        const { rows } = await pool.query(
            `INSERT INTO wawancara_interviews (interviewer_id, applicant_id, candidate_name, candidate_registration_no, 
             candidate_origin_school, candidate_birth_date, candidate_parent_name, status, academic_year_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8) RETURNING *`,
            [req.user.userId, applicant_id, candidateName, candidateRegNo,
                candidateSchool, candidateBirthDate, candidateParentName, applicant.academic_year_id]
        );

        res.json({ data: { ...rows[0], meeting_link: meetingLink }, error: null });
    } catch (err) {
        console.error('Create interview from request error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// POST /api/wawancara/interviews (create new)
router.post('/interviews', async (req, res) => {
    try {
        const {
            applicant_id, candidate_name, candidate_registration_no,
            candidate_origin_school, candidate_birth_date, candidate_parent_name, academic_year_id
        } = req.body;

        const { rows } = await pool.query(
            `INSERT INTO wawancara_interviews (interviewer_id, applicant_id, candidate_name, candidate_registration_no, 
             candidate_origin_school, candidate_birth_date, candidate_parent_name, status, academic_year_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8) RETURNING *`,
            [req.user.userId, applicant_id || null, candidate_name || '', candidate_registration_no || '',
            candidate_origin_school || '', candidate_birth_date || null, candidate_parent_name || '', academic_year_id || null]
        );
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Create interview error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// PUT /api/wawancara/interviews/:id (update / autosave)
router.put('/interviews/:id', async (req, res) => {
    try {
        const {
            candidate_name, candidate_registration_no, candidate_origin_school,
            candidate_birth_date, candidate_parent_name, general_notes, status, autosave_data
        } = req.body;

        const { rows } = await pool.query(
            `UPDATE wawancara_interviews SET 
             candidate_name = COALESCE($1, candidate_name),
             candidate_registration_no = COALESCE($2, candidate_registration_no),
             candidate_origin_school = COALESCE($3, candidate_origin_school),
             candidate_birth_date = COALESCE($4, candidate_birth_date),
             candidate_parent_name = COALESCE($5, candidate_parent_name),
             general_notes = COALESCE($6, general_notes),
             status = COALESCE($7, status),
             autosave_data = COALESCE($8, autosave_data),
             updated_at = NOW()
             WHERE id = $9 RETURNING *`,
            [candidate_name, candidate_registration_no, candidate_origin_school,
                candidate_birth_date, candidate_parent_name, general_notes, status,
                autosave_data ? JSON.stringify(autosave_data) : null, req.params.id]
        );
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Update interview error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// DELETE /api/wawancara/interviews/:id
router.delete('/interviews/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM wawancara_interviews WHERE id = $1', [req.params.id]);
        res.json({ data: { success: true }, error: null });
    } catch (err) {
        console.error('Delete interview error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// POST /api/wawancara/interviews/:id/scores (upsert scores)
router.post('/interviews/:id/scores', async (req, res) => {
    try {
        const { scores } = req.body; // [{ criteria_id, score, notes }]
        const results = [];

        for (const s of scores) {
            const { rows } = await pool.query(
                `INSERT INTO wawancara_scores (interview_id, criteria_id, score, notes)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (interview_id, criteria_id) DO UPDATE SET score = $3, notes = $4
                 RETURNING *`,
                [req.params.id, s.criteria_id, s.score, s.notes || '']
            );
            results.push(rows[0]);
        }

        res.json({ data: results, error: null });
    } catch (err) {
        console.error('Upsert scores error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// POST /api/wawancara/interviews/:id/notes (upsert notes)
router.post('/interviews/:id/notes', async (req, res) => {
    try {
        const { notes } = req.body; // [{ question_id, question_text, answer_text }]
        const results = [];

        for (const n of notes) {
            // Delete existing note for this question in this interview, then insert
            if (n.question_id) {
                await pool.query(
                    'DELETE FROM wawancara_notes WHERE interview_id = $1 AND question_id = $2',
                    [req.params.id, n.question_id]
                );
            }
            const { rows } = await pool.query(
                `INSERT INTO wawancara_notes (interview_id, question_id, question_text, answer_text)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [req.params.id, n.question_id || null, n.question_text || '', n.answer_text || '']
            );
            results.push(rows[0]);
        }

        res.json({ data: results, error: null });
    } catch (err) {
        console.error('Upsert notes error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// POST /api/wawancara/interviews/:id/finalize
router.post('/interviews/:id/finalize', async (req, res) => {
    try {
        const { final_recommendation } = req.body;
        const interviewId = req.params.id;

        // Get scores and criteria
        const { rows: scores } = await pool.query(
            'SELECT ws.*, wc.weight FROM wawancara_scores ws JOIN wawancara_criteria wc ON wc.id = ws.criteria_id WHERE ws.interview_id = $1',
            [interviewId]
        );

        // Calculate weighted score
        let totalWeight = 0;
        let weightedSum = 0;
        let rawSum = 0;
        let count = 0;

        for (const score of scores) {
            if (score.score === 0) continue;
            rawSum += score.score;
            weightedSum += score.score * score.weight;
            totalWeight += score.weight;
            count++;
        }

        const totalScore = count > 0 ? Math.round((rawSum / count) * 100) / 100 : 0;
        const weightedScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

        // Update interview
        const { rows } = await pool.query(
            `UPDATE wawancara_interviews 
             SET status = 'completed', total_score = $1, weighted_score = $2, 
                 final_recommendation = $3, updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [totalScore, weightedScore, final_recommendation || '', interviewId]
        );

        // Also update the applicant's interview_score if linked
        if (rows[0]?.applicant_id) {
            await pool.query(
                `UPDATE applicants SET interview_score = $1, interview_status = 'completed', updated_at = NOW() WHERE id = $2`,
                [weightedScore, rows[0].applicant_id]
            );
        }

        res.json({ data: { ...rows[0], total_score: totalScore, weighted_score: weightedScore }, error: null });
    } catch (err) {
        console.error('Finalize interview error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// ============================================================
// AI ANALYSIS
// ============================================================

// POST /api/wawancara/ai/analyze
router.post('/ai/analyze', async (req, res) => {
    try {
        const { provider, api_key, model, mode, criteria_name, criteria_description, criteria_rubric, questions, system_prompt } = req.body;

        const systemMsg = system_prompt || `Anda adalah asisten evaluator wawancara penerimaan siswa baru. 
Tugas Anda adalah menganalisis jawaban kandidat berdasarkan kriteria dan rubrik yang diberikan.
Berikan skor 1-5 dan penjelasan dalam Bahasa Indonesia.`;

        let userMsg = `Kriteria: ${criteria_name}\nDeskripsi: ${criteria_description}\n\nRubrik Penilaian:\n${criteria_rubric}\n\n`;

        if (mode === 'per_question') {
            const q = questions[0];
            userMsg += `Pertanyaan: ${q.question_text}\nPanduan Jawaban: ${q.answer_guide}\n`;
            if (q.ai_rubric) userMsg += `Rubrik Khusus: ${q.ai_rubric}\n`;
            userMsg += `\nJawaban Kandidat: ${q.answer_text}\n`;
        } else {
            userMsg += `Berikut jawaban kandidat untuk semua pertanyaan:\n\n`;
            for (const q of questions) {
                userMsg += `Q: ${q.question_text}\nA: ${q.answer_text}\n\n`;
            }
        }

        userMsg += `\nBerikan respons dalam format JSON berikut (tanpa markdown):
{"suggested_score": <1-5>, "justification": "<penjelasan skor>", "feedback": "<saran untuk kandidat>"}`;

        let result;

        if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                body: JSON.stringify({
                    model: model || 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemMsg },
                        { role: 'user', content: userMsg }
                    ],
                    temperature: 0.3,
                    response_format: { type: 'json_object' }
                })
            });
            if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
            const data = await response.json();
            result = JSON.parse(data.choices[0].message.content);
            result.model_used = model || 'gpt-4o-mini';
        } else if (provider === 'gemini') {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${api_key}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: systemMsg + '\n\n' + userMsg }] }],
                        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
                    })
                }
            );
            if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            result = JSON.parse(text);
            result.model_used = model || 'gemini-2.0-flash';
        } else {
            return res.status(400).json({ data: null, error: 'Unsupported provider' });
        }

        res.json(result);
    } catch (err) {
        console.error('AI analyze error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wawancara/ai/save-analysis
router.post('/ai/save-analysis', async (req, res) => {
    try {
        const { interview_id, criteria_id, question_id, analysis_type, input_text, suggested_score, justification, feedback, model_used } = req.body;
        const { rows } = await pool.query(
            `INSERT INTO wawancara_ai_analyses (interview_id, criteria_id, question_id, analysis_type, input_text, suggested_score, justification, feedback, model_used)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [interview_id, criteria_id, question_id || null, analysis_type || 'per_criteria', input_text || '', suggested_score, justification || '', feedback || '', model_used || '']
        );
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Save AI analysis error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// PUT /api/wawancara/ai/analyses/:id/accept
router.put('/ai/analyses/:id/accept', async (req, res) => {
    try {
        const { accepted } = req.body;
        const { rows } = await pool.query(
            'UPDATE wawancara_ai_analyses SET accepted = $1 WHERE id = $2 RETURNING *',
            [accepted, req.params.id]
        );
        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Accept AI analysis error:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// Helper for WhatsApp
function formatPhoneNumber(phone, countryCode) {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
        cleaned = countryCode + cleaned.substring(1);
    } else if (!cleaned.startsWith(countryCode)) {
        cleaned = countryCode + cleaned;
    }
    return cleaned;
}

// POST /api/wawancara/notify-interviewer
router.post('/notify-interviewer', async (req, res) => {
    try {
        const {
            interview_request_id,
            interviewer_id,
            interviewer_email,
            interviewer_name,
            student_name,
            registration_number,
            interview_date,
            interview_time,
            interview_type,
            meeting_link,
            admin_notes,
        } = req.body;

        if (!interviewer_email || !interviewer_name || !student_name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Fetch template
        const { rows: templates } = await pool.query(
            "SELECT * FROM email_templates WHERE template_key = 'interview_assigned' AND is_active = true"
        );
        const template = templates[0];

        if (!template) {
            return res.status(500).json({ error: 'Email template not found' });
        }

        let subject = template.subject
            .replace(/\{\{interviewer_name\}\}/g, interviewer_name)
            .replace(/\{\{student_name\}\}/g, student_name)
            .replace(/\{\{registration_number\}\}/g, registration_number)
            .replace(/\{\{interview_date\}\}/g, interview_date)
            .replace(/\{\{interview_time\}\}/g, interview_time)
            .replace(/\{\{interview_type\}\}/g, interview_type);

        let htmlBody = template.html_body
            .replace(/\{\{interviewer_name\}\}/g, interviewer_name)
            .replace(/\{\{student_name\}\}/g, student_name)
            .replace(/\{\{registration_number\}\}/g, registration_number)
            .replace(/\{\{interview_date\}\}/g, interview_date)
            .replace(/\{\{interview_time\}\}/g, interview_time)
            .replace(/\{\{interview_type\}\}/g, interview_type);

        let textBody = template.text_body
            .replace(/\{\{interviewer_name\}\}/g, interviewer_name)
            .replace(/\{\{student_name\}\}/g, student_name)
            .replace(/\{\{registration_number\}\}/g, registration_number)
            .replace(/\{\{interview_date\}\}/g, interview_date)
            .replace(/\{\{interview_time\}\}/g, interview_time)
            .replace(/\{\{interview_type\}\}/g, interview_type);

        if (meeting_link) {
            htmlBody = htmlBody.replace(/\{\{#if meeting_link\}\}([\s\S]*?)\{\{\/#if\}\}/g, '$1')
                .replace(/\{\{meeting_link\}\}/g, meeting_link);
            textBody = textBody.replace(/\{\{#if meeting_link\}\}([\s\S]*?)\{\{\/#if\}\}/g, '$1')
                .replace(/\{\{meeting_link\}\}/g, meeting_link);
        } else {
            htmlBody = htmlBody.replace(/\{\{#if meeting_link\}\}[\s\S]*?\{\{\/#if\}\}/g, '');
            textBody = textBody.replace(/\{\{#if meeting_link\}\}[\s\S]*?\{\{\/#if\}\}/g, '');
        }

        if (admin_notes) {
            htmlBody = htmlBody.replace(/\{\{#if admin_notes\}\}([\s\S]*?)\{\{\/#if\}\}/g, '$1')
                .replace(/\{\{admin_notes\}\}/g, admin_notes);
            textBody = textBody.replace(/\{\{#if admin_notes\}\}([\s\S]*?)\{\{\/#if\}\}/g, '$1')
                .replace(/\{\{admin_notes\}\}/g, admin_notes);
        } else {
            htmlBody = htmlBody.replace(/\{\{#if admin_notes\}\}[\s\S]*?\{\{\/#if\}\}/g, '');
            textBody = textBody.replace(/\{\{#if admin_notes\}\}[\s\S]*?\{\{\/#if\}\}/g, '');
        }

        let whatsappSuccess = false;
        let whatsappError = null;
        let emailSuccess = false;
        let emailResult = null;

        // Verify interviewer permissions
        const { rows: interviewerDataRows } = await pool.query(
            "SELECT phone, whatsapp_notifications, email_notifications, user_id FROM interviewers WHERE id = $1",
            [interviewer_id]
        );
        const interviewerData = interviewerDataRows[0];

        if (interviewerData?.email_notifications !== false) {
            const resendApiKey = process.env.RESEND_API_KEY;
            if (!resendApiKey) {
                console.error('RESEND_API_KEY not configured');
                await pool.query(
                    `INSERT INTO email_logs (recipient_email, recipient_type, email_type, subject, status, error_message, interview_request_id, sent_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [interviewer_email, 'interviewer', 'interview_assigned', subject, 'failed', 'RESEND_API_KEY not configured', interview_request_id, req.user.userId]
                );
            } else {
                const emailResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify({
                        from: process.env.EMAIL_FROM || 'noreply@example.com',
                        to: [interviewer_email],
                        subject,
                        html: htmlBody,
                        text: textBody,
                    }),
                });

                emailResult = await emailResponse.json();
                emailSuccess = emailResponse.ok;

                await pool.query(
                    `INSERT INTO email_logs (recipient_email, recipient_type, email_type, subject, status, error_message, interview_request_id, sent_by, sent_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        interviewer_email,
                        'interviewer',
                        'interview_assigned',
                        subject,
                        emailSuccess ? 'sent' : 'failed',
                        emailSuccess ? null : JSON.stringify(emailResult),
                        interview_request_id,
                        req.user.userId,
                        emailSuccess ? new Date().toISOString() : null
                    ]
                );

                if (!emailSuccess) {
                    console.error('Failed to send email:', emailResult);
                }
            }
        }

        // WhatsApp logic 
        if (interviewerData?.phone && interviewerData?.whatsapp_notifications) {
            const { rows: configData } = await pool.query(
                "SELECT key, value FROM app_config WHERE key IN ('fonnte_api_token', 'fonnte_country_code', 'fonnte_enabled')"
            );
            const configMap = new Map(configData.map(c => [c.key, c.value]));
            const fonnte_enabled = configMap.get('fonnte_enabled');
            const fonnte_api_token = configMap.get('fonnte_api_token');
            const fonnte_country_code = configMap.get('fonnte_country_code') || '62';

            if (fonnte_enabled && fonnte_api_token) {
                const whatsappMessage = `🎯 *Penugasan Interview Baru*\n\nHalo ${interviewer_name},\n\nAnda telah ditugaskan untuk melakukan interview dengan calon siswa:\n\n👤 *Nama Siswa:* ${student_name}\n📝 *No. Registrasi:* ${registration_number}\n📅 *Tanggal:* ${interview_date}\n⏰ *Waktu:* ${interview_time}\n📍 *Tipe:* ${interview_type}${meeting_link ? `\n🔗 *Link Meeting:* ${meeting_link}` : ''}${admin_notes ? `\n\n📌 *Catatan Admin:* ${admin_notes}` : ''}\n\nTerima kasih atas dedikasi Anda!`;
                const formattedPhone = formatPhoneNumber(interviewerData.phone, String(fonnte_country_code));

                // UUID v4
                const logId = crypto.randomUUID();

                await pool.query(
                    `INSERT INTO whatsapp_logs 
                     (id, recipient_phone, recipient_name, message_type, message_body, status, interview_request_id, recipient_user_id, sent_by, created_at) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
                    [logId, formattedPhone, interviewer_name, 'interview_assigned', whatsappMessage, 'pending', interview_request_id, interviewerData.user_id || null, req.user.userId]
                );

                try {
                    const fonnte_response = await fetch('https://api.fonnte.com/send', {
                        method: 'POST',
                        headers: {
                            'Authorization': String(fonnte_api_token),
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            target: formattedPhone,
                            message: whatsappMessage,
                            countryCode: String(fonnte_country_code),
                        }),
                    });

                    const fonnte_result = await fonnte_response.json();
                    if (fonnte_response.ok && fonnte_result.status !== false) {
                        await pool.query(
                            "UPDATE whatsapp_logs SET status = 'sent', sent_at = NOW() WHERE id = $1",
                            [logId]
                        );
                        whatsappSuccess = true;
                    } else {
                        const errorMessage = fonnte_result.reason || fonnte_result.message || 'Unknown error from Fonnte API';
                        whatsappError = errorMessage;
                        await pool.query(
                            "UPDATE whatsapp_logs SET status = 'failed', error_message = $1 WHERE id = $2",
                            [errorMessage, logId]
                        );
                    }
                } catch (apiError) {
                    const errorMsg = apiError instanceof Error ? apiError.message : 'Failed to send WhatsApp message';
                    whatsappError = errorMsg;
                    await pool.query(
                        "UPDATE whatsapp_logs SET status = 'failed', error_message = $1 WHERE id = $2",
                        [errorMsg, logId]
                    );
                }
            }
        }

        res.json({
            success: true,
            email_sent: emailSuccess,
            whatsapp_sent: whatsappSuccess,
            whatsapp_error: whatsappError
        });
    } catch (err) {
        console.error('Notify interviewer error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
