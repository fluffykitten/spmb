import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/spmb' });

async function run() {
    try {
        const { rows: applicants } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'applicants'
    `);
        console.log('--- APPLICANTS TABLE ---');
        console.table(applicants);

        const { rows: interviews } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'interview_requests'
    `);
        console.log('\n--- INTERVIEW REQUESTS TABLE ---');
        console.table(interviews);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
