import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Helper: Build dynamic query from Supabase-like parameters
function buildSelectQuery(table, query) {
    const { select, filters, order, limit, offset, single } = query;
    const cols = select || '*';
    let sql = `SELECT ${cols} FROM ${table}`;
    const params = [];
    const wheres = [];

    if (filters) {
        for (const f of filters) {
            params.push(f.value);
            if (f.op === 'eq') wheres.push(`${f.column} = $${params.length}`);
            else if (f.op === 'neq') wheres.push(`${f.column} != $${params.length}`);
            else if (f.op === 'gt') wheres.push(`${f.column} > $${params.length}`);
            else if (f.op === 'gte') wheres.push(`${f.column} >= $${params.length}`);
            else if (f.op === 'lt') wheres.push(`${f.column} < $${params.length}`);
            else if (f.op === 'lte') wheres.push(`${f.column} <= $${params.length}`);
            else if (f.op === 'like') wheres.push(`${f.column} LIKE $${params.length}`);
            else if (f.op === 'ilike') wheres.push(`${f.column} ILIKE $${params.length}`);
            else if (f.op === 'is') {
                params.pop();
                wheres.push(`${f.column} IS ${f.value === 'null' || f.value === null ? 'NULL' : 'NOT NULL'}`);
            }
            else if (f.op === 'in') {
                params.pop();
                const arr = Array.isArray(f.value) ? f.value : JSON.parse(f.value);
                const placeholders = arr.map((v) => { params.push(v); return `$${params.length}`; });
                wheres.push(`${f.column} IN (${placeholders.join(',')})`);
            }
            else if (f.op === 'contains') {
                wheres.push(`${f.column} @> $${params.length}`);
            }
        }
    }

    if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
    if (order) sql += ` ORDER BY ${order}`;
    if (limit) sql += ` LIMIT ${parseInt(limit)}`;
    if (offset) sql += ` OFFSET ${parseInt(offset)}`;

    return { sql, params, single };
}

// Allowed tables for generic CRUD
const ALLOWED_TABLES = [
    'profiles', 'applicants', 'payment_records', 'payment_history',
    'letter_templates', 'app_config', 'interviewers', 'interview_sessions',
    'interview_slots', 'interview_bookings', 'interview_evaluations',
    'interview_criteria', 'exams', 'exam_questions', 'exam_question_options',
    'exam_attempts', 'exam_answers', 'exam_results', 'exam_proctoring_logs',
    'exam_tokens', 'exam_token_redemptions', 'audit_logs',
    'whatsapp_notification_logs', 'document_generations', 'form_schemas',
    'registration_batches', 'slideshow_images', 'interview_requests', 'whatsapp_logs',
    'whatsapp_templates',
    'user_monitoring_status', 'letterhead_config'
];

// Virtual views - these are complex queries that look like tables to the frontend
const VIRTUAL_VIEWS = {
    'user_monitoring_status': `
        SELECT 
            p.id as profile_id,
            p.user_id,
            p.full_name,
            p.email,
            COALESCE(p.phone, p.phone_number) as phone_number,
            a.id as applicant_id,
            a.registration_number,
            a.status as form_status,
            a.created_at as application_date,
            a.interview_status,
            a.interview_score,
            a.exam_status,
            a.exam_score,
            a.final_score,
            COALESCE(doc_count.cnt, 0)::int as documents_downloaded_count,
            COALESCE(doc_total.cnt, 0)::int as total_documents_count,
            ir.status as latest_interview_request_status,
            COALESCE(ea_count.cnt, 0)::int as exam_attempts_count,
            pr_entrance.payment_status as entrance_fee_status,
            pr_entrance.paid_amount as entrance_fee_paid,
            pr_entrance.total_amount as entrance_fee_total,
            pr_admin.payment_status as administration_fee_status,
            pr_admin.paid_amount as administration_fee_paid,
            pr_admin.total_amount as administration_fee_total
        FROM profiles p
        LEFT JOIN applicants a ON a.user_id = p.user_id
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int as cnt FROM document_generations dg WHERE dg.applicant_id = a.id
        ) doc_count ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int as cnt FROM letter_templates lt WHERE lt.is_active = true AND (lt.is_available_for_students = true OR lt.is_self_service = true)
        ) doc_total ON true
        LEFT JOIN LATERAL (
            SELECT ir2.status FROM interview_requests ir2 
            WHERE ir2.applicant_id = a.id 
            ORDER BY ir2.created_at DESC LIMIT 1
        ) ir ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int as cnt FROM exam_attempts ea WHERE ea.applicant_id = a.id
        ) ea_count ON true
        LEFT JOIN payment_records pr_entrance ON pr_entrance.applicant_id = a.id AND pr_entrance.payment_type = 'entrance_fee'
        LEFT JOIN payment_records pr_admin ON pr_admin.applicant_id = a.id AND pr_admin.payment_type = 'administration_fee'
        WHERE p.role = 'student'
        ORDER BY a.created_at DESC NULLS LAST
    `,
    'letterhead_config': null // Use the actual table name
};

// Tables that can be queried without authentication (public landing page)
const PUBLIC_TABLES = ['app_config', 'registration_batches', 'slideshow_images'];

function validateTable(table) {
    if (!ALLOWED_TABLES.includes(table)) {
        throw new Error(`Table '${table}' is not allowed`);
    }
}

// Helper to stringify arrays and objects for JSONB columns
function prepareValues(values) {
    return values.map(v => (Array.isArray(v) || (v && typeof v === 'object' && !(v instanceof Date))) ? JSON.stringify(v) : v);
}

// POST /api/data/query - Generic select query (public tables don't need auth)
router.post('/query', async (req, res) => {
    try {
        const { table, select, filters, order, limit, offset, single } = req.body;
        validateTable(table);

        // If not a public table, require auth
        if (!PUBLIC_TABLES.includes(table)) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({ data: null, error: 'Access token required' });
            }
            const jwt = await import('jsonwebtoken');
            try {
                jwt.default.verify(token, process.env.JWT_SECRET);
            } catch {
                return res.status(403).json({ data: null, error: 'Invalid or expired token' });
            }
        }

        // Check if this is a virtual view
        if (table in VIRTUAL_VIEWS && VIRTUAL_VIEWS[table]) {
            const viewSql = VIRTUAL_VIEWS[table];
            const { rows } = await pool.query(viewSql);
            res.json({ data: single ? (rows[0] || null) : rows, error: null });
        } else {
            const { sql, params } = buildSelectQuery(table, { select, filters, order, limit, offset, single });
            const { rows } = await pool.query(sql, params);
            res.json({ data: single ? (rows[0] || null) : rows, error: null });
        }
    } catch (err) {
        console.error('Query error:', err);
        res.status(400).json({ data: null, error: err.message });
    }
});

// POST /api/data/insert - Generic insert
router.post('/insert', authenticateToken, async (req, res) => {
    try {
        const { table, data, returning } = req.body;
        validateTable(table);
        const records = Array.isArray(data) ? data : [data];
        const allResults = [];

        for (const record of records) {
            const keys = Object.keys(record);
            const values = prepareValues(Object.values(record));
            const placeholders = keys.map((_, i) => `$${i + 1}`);
            const ret = returning || '*';
            const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders.join(',')}) RETURNING ${ret}`;
            const { rows } = await pool.query(sql, values);
            allResults.push(rows[0]);
        }

        res.json({ data: Array.isArray(data) ? allResults : allResults[0], error: null });
    } catch (err) {
        console.error('Insert error:', err);
        res.status(400).json({ data: null, error: err.message });
    }
});

// POST /api/data/update - Generic update
router.post('/update', authenticateToken, async (req, res) => {
    try {
        const { table, data, filters, returning } = req.body;
        validateTable(table);
        const keys = Object.keys(data);
        const values = prepareValues(Object.values(data));
        const sets = keys.map((k, i) => `${k} = $${i + 1}`);
        let sql = `UPDATE ${table} SET ${sets.join(', ')}`;
        const params = [...values];
        const wheres = [];

        if (filters) {
            for (const f of filters) {
                params.push(f.value);
                if (f.op === 'eq') wheres.push(`${f.column} = $${params.length}`);
                else if (f.op === 'in') {
                    params.pop();
                    const arr = Array.isArray(f.value) ? f.value : JSON.parse(f.value);
                    const ph = arr.map(v => { params.push(v); return `$${params.length}`; });
                    wheres.push(`${f.column} IN (${ph.join(',')})`);
                }
            }
        }

        if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
        const ret = returning || '*';
        sql += ` RETURNING ${ret}`;

        const { rows } = await pool.query(sql, params);
        res.json({ data: rows, error: null });
    } catch (err) {
        console.error('Update error:', err);
        res.status(400).json({ data: null, error: err.message });
    }
});

// POST /api/data/delete - Generic delete
router.post('/delete', authenticateToken, async (req, res) => {
    try {
        const { table, filters } = req.body;
        validateTable(table);
        let sql = `DELETE FROM ${table}`;
        const params = [];
        const wheres = [];

        if (filters) {
            for (const f of filters) {
                params.push(f.value);
                if (f.op === 'eq') wheres.push(`${f.column} = $${params.length}`);
            }
        }

        if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
        sql += ' RETURNING *';

        const { rows } = await pool.query(sql, params);
        res.json({ data: rows, error: null });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(400).json({ data: null, error: err.message });
    }
});

// POST /api/data/upsert - Generic upsert
router.post('/upsert', authenticateToken, async (req, res) => {
    try {
        const { table, data, onConflict, returning } = req.body;
        validateTable(table);
        const records = Array.isArray(data) ? data : [data];
        const allResults = [];

        for (const record of records) {
            const keys = Object.keys(record);
            const values = prepareValues(Object.values(record));
            const placeholders = keys.map((_, i) => `$${i + 1}`);
            const conflictCol = onConflict || 'id';
            const updateSets = keys.filter(k => k !== conflictCol).map((k, i) => `${k} = EXCLUDED.${k}`);
            const ret = returning || '*';

            let sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders.join(',')})`;
            sql += ` ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateSets.join(', ')}`;
            sql += ` RETURNING ${ret}`;

            const { rows } = await pool.query(sql, values);
            allResults.push(rows[0]);
        }

        res.json({ data: Array.isArray(data) ? allResults : allResults[0], error: null });
    } catch (err) {
        console.error('Upsert error:', err);
        res.status(400).json({ data: null, error: err.message });
    }
});

export default router;
