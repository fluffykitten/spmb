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
            `CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_key VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        html_body TEXT NOT NULL,
        text_body TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
            `CREATE TABLE IF NOT EXISTS email_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_email VARCHAR(255) NOT NULL,
        recipient_type VARCHAR(50),
        email_type VARCHAR(100),
        subject VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        interview_request_id UUID REFERENCES interview_requests(id) ON DELETE SET NULL,
        sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
        sent_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
            `INSERT INTO email_templates (template_key, name, subject, html_body, text_body) 
       VALUES (
        'interview_assigned',
        'Penugasan Wawancara',
        'Penugasan Wawancara Calon Siswa {{student_name}}',
        '<p>Halo {{interviewer_name}},</p><p>Anda telah ditugaskan untuk melakukan interview dengan calon siswa:</p><ul><li><strong>Nama Siswa:</strong> {{student_name}}</li><li><strong>No. Registrasi:</strong> {{registration_number}}</li><li><strong>Tanggal:</strong> {{interview_date}}</li><li><strong>Waktu:</strong> {{interview_time}}</li><li><strong>Tipe:</strong> {{interview_type}}</li></ul>{{#if meeting_link}}<p><strong>Link Meeting:</strong> <a href=\"{{meeting_link}}\">{{meeting_link}}</a></p>{{/if}}{{#if admin_notes}}<p><strong>Catatan Admin:</strong> {{admin_notes}}</p>{{/if}}<p>Terima kasih atas dedikasi Anda!</p>',
        'Halo {{interviewer_name}},\n\nAnda telah ditugaskan untuk melakukan interview dengan calon siswa:\n\nNama Siswa: {{student_name}}\nNo. Registrasi: {{registration_number}}\nTanggal: {{interview_date}}\nWaktu: {{interview_time}}\nTipe: {{interview_type}}\n{{#if meeting_link}}\nLink Meeting: {{meeting_link}}\n{{/if}}\n{{#if admin_notes}}\nCatatan Admin: {{admin_notes}}\n{{/if}}\n\nTerima kasih atas dedikasi Anda!'
       ) ON CONFLICT (template_key) DO NOTHING;`
        ];

        for (const q of queries) {
            await pool.query(q);
        }

        console.log('Tables email_logs & email_templates created and seeded successfully.');
    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        await pool.end();
    }
}

run();
