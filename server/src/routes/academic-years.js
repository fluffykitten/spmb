import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET /api/academic-years - List all academic years
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM academic_years ORDER BY code DESC'
        );
        res.json({ data: rows, error: null });
    } catch (err) {
        console.error('Error fetching academic years:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// GET /api/academic-years/active - Get active academic year
router.get('/active', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM academic_years WHERE is_active = true LIMIT 1'
        );
        res.json({ data: rows[0] || null, error: null });
    } catch (err) {
        console.error('Error fetching active academic year:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// POST /api/academic-years - Create new academic year (admin only)
router.post('/', authenticateToken, async (req, res) => {
    try {
        // Verify admin
        const { rows: profiles } = await pool.query(
            "SELECT role FROM profiles WHERE user_id = $1", [req.user.userId]
        );
        if (!profiles.length || profiles[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can perform this action' });
        }

        const { name, code, start_date, end_date } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: 'Name and code are required' });
        }

        // Check duplicate code
        const { rows: existing } = await pool.query(
            'SELECT id FROM academic_years WHERE code = $1', [code]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Academic year with this code already exists' });
        }

        const { rows } = await pool.query(
            `INSERT INTO academic_years (name, code, start_date, end_date, is_active)
             VALUES ($1, $2, $3, $4, false) RETURNING *`,
            [name, code, start_date || null, end_date || null]
        );

        res.status(201).json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Error creating academic year:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// PUT /api/academic-years/:id - Update academic year (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows: profiles } = await pool.query(
            "SELECT role FROM profiles WHERE user_id = $1", [req.user.userId]
        );
        if (!profiles.length || profiles[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can perform this action' });
        }

        const { name, code, start_date, end_date } = req.body;
        const { id } = req.params;

        const { rows } = await pool.query(
            `UPDATE academic_years 
             SET name = COALESCE($1, name), 
                 code = COALESCE($2, code), 
                 start_date = COALESCE($3, start_date), 
                 end_date = COALESCE($4, end_date),
                 updated_at = NOW()
             WHERE id = $5 RETURNING *`,
            [name, code, start_date, end_date, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Academic year not found' });
        }

        res.json({ data: rows[0], error: null });
    } catch (err) {
        console.error('Error updating academic year:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

// PUT /api/academic-years/:id/activate - Activate academic year (admin only)
router.put('/:id/activate', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { rows: profiles } = await client.query(
            "SELECT role FROM profiles WHERE user_id = $1", [req.user.userId]
        );
        if (!profiles.length || profiles[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can perform this action' });
        }

        await client.query('BEGIN');

        // Deactivate all
        await client.query('UPDATE academic_years SET is_active = false, updated_at = NOW()');

        // Activate selected
        const { rows } = await client.query(
            'UPDATE academic_years SET is_active = true, updated_at = NOW() WHERE id = $1 RETURNING *',
            [req.params.id]
        );

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Academic year not found' });
        }

        await client.query('COMMIT');
        res.json({ data: rows[0], error: null });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error activating academic year:', err);
        res.status(500).json({ data: null, error: err.message });
    } finally {
        client.release();
    }
});

// DELETE /api/academic-years/:id - Delete academic year (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows: profiles } = await pool.query(
            "SELECT role FROM profiles WHERE user_id = $1", [req.user.userId]
        );
        if (!profiles.length || profiles[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can perform this action' });
        }

        const { id } = req.params;

        // Check if there are any associated records
        const { rows: applicants } = await pool.query(
            'SELECT id FROM applicants WHERE academic_year_id = $1 LIMIT 1', [id]
        );
        if (applicants.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete: there are applicants associated with this academic year'
            });
        }

        const { rows: batches } = await pool.query(
            'SELECT id FROM registration_batches WHERE academic_year_id = $1 LIMIT 1', [id]
        );
        if (batches.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete: there are registration batches associated with this academic year'
            });
        }

        const { rowCount } = await pool.query(
            'DELETE FROM academic_years WHERE id = $1', [id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Academic year not found' });
        }

        res.json({ data: { success: true }, error: null });
    } catch (err) {
        console.error('Error deleting academic year:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

export default router;
