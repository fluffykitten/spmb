import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const queries = [
            'ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);',
            'ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;',
            'ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id);',
            'ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;',
            'ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS revision_requested_notes TEXT;',
            'ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;',
            'ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;',
            'ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS meeting_link TEXT;',
        ];

        for (const q of queries) {
            await pool.query(q);
        }

        console.log('Columns added successfully.');
    } catch (err) {
        console.error('Error adding columns:', err);
    } finally {
        await pool.end();
    }
}

run();
