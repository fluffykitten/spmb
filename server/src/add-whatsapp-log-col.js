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
        const q = 'ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS interview_request_id UUID REFERENCES interview_requests(id) ON DELETE SET NULL;';
        await pool.query(q);
        console.log('Column interview_request_id added to whatsapp_logs successfully.');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        await pool.end();
    }
}

run();
