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
        const q1 = "ALTER TABLE whatsapp_logs DROP CONSTRAINT IF EXISTS whatsapp_logs_sent_by_fkey;";
        const q2 = "ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_sent_by_fkey;";
        const q3 = "ALTER TABLE whatsapp_logs DROP CONSTRAINT IF EXISTS whatsapp_logs_recipient_user_id_fkey;";
        const q4 = "ALTER TABLE whatsapp_logs DROP CONSTRAINT IF EXISTS whatsapp_logs_interview_request_id_fkey;";
        const q5 = "ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_interview_request_id_fkey;";

        await pool.query(q1);
        await pool.query(q2);
        // Safe to drop other fk constraints to avoid insert failures for logs.
        await pool.query(q3);
        await pool.query(q4);
        await pool.query(q5);

        console.log('Foreign key constraints on log tables dropped successfully.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
