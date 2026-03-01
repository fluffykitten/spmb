import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/spmb' });
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      applicant_id UUID REFERENCES applicants(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending_review',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('interview_requests table created');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await pool.end();
  process.exit(0);
}
