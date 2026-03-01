import { Router } from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/applicants/generate-registration-number
router.post('/generate-registration-number', authenticateToken, async (req, res) => {
    try {
        // Format: Academic Year (e.g., 2526) + Year (26) + Month (02) + Day (28) + sequence (020)
        // Example: 2526260228020

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        // Calculate academic year (e.g., if month >= 7, it's 2425, else 2324 for early 2024)
        // Based on user example: 2526 for year 2026.
        const currentYear2Digit = year % 100;
        let academicYear = "";
        if (now.getMonth() >= 6) { // July or later
            academicYear = `${currentYear2Digit}${currentYear2Digit + 1}`;
        } else {
            academicYear = `${currentYear2Digit - 1}${currentYear2Digit}`;
        }

        const datePrefix = `${currentYear2Digit}${month}${day}`;
        const prefix = `${academicYear}${datePrefix}`;

        // Find existing applicants today to increment the sequence
        const { rows } = await pool.query(
            "SELECT registration_number FROM applicants WHERE registration_number LIKE $1 ORDER BY registration_number DESC LIMIT 1",
            [`${prefix}%`]
        );

        let sequence = 1;
        if (rows.length > 0 && rows[0].registration_number) {
            const lastRegNumber = rows[0].registration_number;
            const lastSeqStr = lastRegNumber.substring(prefix.length);
            const lastSeq = parseInt(lastSeqStr, 10);
            if (!isNaN(lastSeq)) {
                sequence = lastSeq + 1;
            }
        }

        const sequenceStr = String(sequence).padStart(3, '0');
        const newRegNumber = `${prefix}${sequenceStr}`;

        res.json({ data: { registration_number: newRegNumber }, error: null });
    } catch (err) {
        console.error('Error generating registration number:', err);
        res.status(500).json({ data: null, error: err.message });
    }
});

export default router;
