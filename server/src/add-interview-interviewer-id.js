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
        await pool.query('ALTER TABLE interview_requests ADD COLUMN IF NOT EXISTS interviewer_id UUID REFERENCES interviewers(id);');
        console.log('Column interviewer_id added successfully.');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        await pool.end();
    }
}

run();
