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
        const q1 = "SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_logs';";
        const res1 = await pool.query(q1);
        const existingCols = res1.rows.map(r => r.column_name);
        console.log('Columns in whatsapp_logs before:', existingCols);

        const queries = [];
        if (!existingCols.includes('interview_request_id')) {
            queries.push('ALTER TABLE whatsapp_logs ADD COLUMN interview_request_id UUID REFERENCES interview_requests(id) ON DELETE SET NULL;');
        }
        if (!existingCols.includes('recipient_user_id')) {
            queries.push('ALTER TABLE whatsapp_logs ADD COLUMN recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL;');
        }
        if (!existingCols.includes('sent_by')) {
            queries.push('ALTER TABLE whatsapp_logs ADD COLUMN sent_by UUID REFERENCES users(id) ON DELETE SET NULL;');
        }

        for (const q of queries) {
            console.log('Running:', q);
            await pool.query(q);
        }

        console.log('Finished updating whatsapp_logs schema.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
