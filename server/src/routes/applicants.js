import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/applicants/generate-registration-number
router.post('/generate-registration-number', authenticateToken, async (req, res) => {
    try {
        // Format: Academic Year Code (e.g., 2526) + Year (26) + Month (02) + Day (28) + sequence (020)
        // Example: 2526260228020

        // Get academic year code from active academic year
        const { rows: yearRows } = await pool.query(
            "SELECT code FROM academic_years WHERE is_active = true LIMIT 1"
        );

        const now = new Date();
        const currentYear2Digit = now.getFullYear() % 100;
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        let academicYear;
        if (yearRows.length > 0 && yearRows[0].code) {
            academicYear = yearRows[0].code;
        } else {
            // Fallback: calculate from date
            if (now.getMonth() >= 6) {
                academicYear = `${currentYear2Digit}${currentYear2Digit + 1}`;
            } else {
                academicYear = `${currentYear2Digit - 1}${currentYear2Digit}`;
            }
        }

        const datePrefix = `${currentYear2Digit}${month}${day}`;
        const prefix = `${academicYear}${datePrefix}`;

        // Find existing applicants for the academic year to increment the sequence continuously
        const { rows } = await pool.query(
            "SELECT registration_number FROM applicants WHERE registration_number LIKE $1",
            [`${academicYear}%`]
        );

        let maxSequence = 0;
        for (const row of rows) {
            if (row.registration_number && row.registration_number.length >= 3) {
                const seqStr = row.registration_number.slice(-3);
                const seq = parseInt(seqStr, 10);
                if (!isNaN(seq) && seq > maxSequence) {
                    maxSequence = seq;
                }
            }
        }
        const sequence = maxSequence + 1;

        const sequenceStr = String(sequence).padStart(3, '0');
        const newRegNumber = `${prefix}${sequenceStr}`;

        res.json({ data: { registration_number: newRegNumber }, error: null });
    } catch (err) {
        console.error('Error generating registration number:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

export default router;
