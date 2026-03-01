import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/spmb' });

async function run() {
    try {
        await pool.query(`
      ALTER TABLE interview_requests 
      ADD COLUMN IF NOT EXISTS student_notes TEXT
    `);
        console.log('Successfully added student_notes to interview_requests table');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
