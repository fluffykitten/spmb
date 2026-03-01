import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/spmb' });

async function run() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        recipient_phone TEXT NOT NULL,
        recipient_name TEXT,
        message_type TEXT NOT NULL,
        message_body TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        applicant_id UUID REFERENCES applicants(id) ON DELETE SET NULL,
        sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        sent_at TIMESTAMPTZ,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        console.log('whatsapp_logs table created');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
