import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:admin@localhost:5432/spmb' });

const templates = [
    {
        key: 'custom_message',
        name: 'Pesan Kustom',
        body: 'Halo {{nama_lengkap}},\n\n{{message_content}}\n\n*SPMB Admin*',
        vars: '["nama_lengkap", "message_content"]'
    },
    {
        key: 'registration_success',
        name: 'Pendaftaran Berhasil',
        body: 'Halo {{nama_lengkap}},\n\nPendaftaran akun Anda di sistem SPMB telah berhasil.\nEmail: {{email}}\n\nSilakan lengkapi formulir pendaftaran Anda.\n\n*SPMB Admin*',
        vars: '["nama_lengkap", "email"]'
    },
    {
        key: 'application_submitted',
        name: 'Formulir Disubmit',
        body: 'Halo {{nama_lengkap}},\n\nFormulir pendaftaran Anda telah berhasil disubmit dan sedang dalam proses verifikasi oleh tim kami.\n\n*SPMB Admin*',
        vars: '["nama_lengkap"]'
    },
    {
        key: 'application_approved',
        name: 'Pendaftaran Diterima',
        body: 'Selamat {{nama_lengkap}}!\n\nPendaftaran Anda telah DITERIMA. Silakan login ke dashboard untuk melihat langkah selanjutnya.\n\n*SPMB Admin*',
        vars: '["nama_lengkap"]'
    },
    {
        key: 'application_revision',
        name: 'Revisi Pendaftaran',
        body: 'Halo {{nama_lengkap}},\n\nTerdapat data/dokumen yang perlu diperbaiki pada pendaftaran Anda:\n{{notes}}\n\nSilakan login untuk memperbaikinya.\n\n*SPMB Admin*',
        vars: '["nama_lengkap", "notes"]'
    },
    {
        key: 'application_rejected',
        name: 'Pendaftaran Ditolak',
        body: 'Mohon maaf {{nama_lengkap}},\n\nPendaftaran Anda belum dapat kami terima saat ini.\nCatatan: {{notes}}\n\n*SPMB Admin*',
        vars: '["nama_lengkap", "notes"]'
    },
    {
        key: 'application_unlocked',
        name: 'Formulir Dibuka Kembali',
        body: 'Halo {{nama_lengkap}},\n\nFormulir pendaftaran Anda telah dibuka kembali untuk perbaikan.\nAlasan: {{notes}}\n\nSilakan login dan perbaiki data Anda.\n\n*SPMB Admin*',
        vars: '["nama_lengkap", "notes"]'
    },
    {
        key: 'exam_results_available',
        name: 'Hasil Ujian Tersedia',
        body: 'Halo {{nama_lengkap}},\n\nHasil ujian Anda telah tersedia. Silakan login ke sistem SPMB untuk melihat nilai dan status kelulusan Anda.\n\n*SPMB Admin*',
        vars: '["nama_lengkap"]'
    },
    {
        key: 'exam_submitted',
        name: 'Ujian Selesai',
        body: 'Halo {{nama_lengkap}},\n\nJawaban ujian Anda telah berhasil disimpan. Terima kasih telah mengikuti ujian.\n\n*SPMB Admin*',
        vars: '["nama_lengkap"]'
    },
    {
        key: 'interview_scheduled',
        name: 'Jadwal Wawancara',
        body: 'Halo {{nama_lengkap}},\n\nJadwal wawancara Anda telah ditentukan:\nTanggal: {{tanggal}}\nWaktu: {{waktu}}\nLokasi/Link: {{lokasi}}\n\nMohon hadir tepat waktu.\n\n*SPMB Admin*',
        vars: '["nama_lengkap", "tanggal", "waktu", "lokasi"]'
    },
    {
        key: 'payment_status_update',
        name: 'Status Pembayaran',
        body: 'Halo {{nama_lengkap}},\n\nStatus pembayaran administrasi Anda telah diupdate menjadi: *{{status}}*.\n{{notes}}\n\n*SPMB Admin*',
        vars: '["nama_lengkap", "status", "notes"]'
    },
    {
        key: 'documents_available',
        name: 'Dokumen Tersedia',
        body: 'Halo {{nama_lengkap}},\n\nSurat/dokumen baru telah diterbitkan untuk Anda di sistem SPMB:\n{{document_name}}\n\nSilakan login untuk mengunduh.\n\n*SPMB Admin*',
        vars: '["nama_lengkap", "document_name"]'
    }
];

async function run() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        template_key TEXT UNIQUE NOT NULL,
        template_name TEXT NOT NULL,
        message_body TEXT NOT NULL,
        variables JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        console.log('Table whatsapp_templates created successfully');

        for (const t of templates) {
            await pool.query(
                `INSERT INTO whatsapp_templates (template_key, template_name, message_body, variables) 
         VALUES ($1, $2, $3, $4::jsonb) 
         ON CONFLICT (template_key) 
         DO UPDATE SET message_body = EXCLUDED.message_body, template_name = EXCLUDED.template_name, variables = EXCLUDED.variables`,
                [t.key, t.name, t.body, t.vars]
            );
        }

        console.log('Inserted 12 WhatsApp templates successfully');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
