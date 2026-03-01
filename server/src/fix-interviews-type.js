import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/spmb' });

async function run() {
    try {
        await pool.query(`
      ALTER TABLE interview_requests 
      ADD COLUMN IF NOT EXISTS proposed_type TEXT DEFAULT 'offline',
      ADD COLUMN IF NOT EXISTS meeting_link TEXT,
      ADD COLUMN IF NOT EXISTS revision_requested_notes TEXT,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    `);
        console.log('Successfully added more missing columns to interview_requests table');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
