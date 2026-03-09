import pool from './db.js';

async function test() {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        const currentYear2Digit = year % 100;
        let academicYear = "";
        if (now.getMonth() >= 6) { // July or later
            academicYear = `${currentYear2Digit}${currentYear2Digit + 1}`;
        } else {
            academicYear = `${currentYear2Digit - 1}${currentYear2Digit}`;
        }

        const datePrefix = `${currentYear2Digit}${month}${day}`;
        const prefix = `${academicYear}${datePrefix}`;

        console.log('Prefix:', prefix);

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

        console.log('New Reg Number:', newRegNumber);

        pool.end();
    } catch (e) {
        console.error(e);
        pool.end();
    }
}

test();
