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
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('email_logs', 'email_templates', 'whatsapp_logs', 'whatsapp_templates');");
        console.log('Tables found:', res.rows.map(r => r.table_name));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
