import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/spmb' });

async function run() {
    try {
        await pool.query(`
      ALTER TABLE interview_requests 
      ADD COLUMN IF NOT EXISTS proposed_time_start TIME,
      ADD COLUMN IF NOT EXISTS proposed_time_end TIME
    `);
        console.log('Successfully added missing columns to interview_requests table');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
