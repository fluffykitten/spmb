import { Client } from 'pg';

const client = new Client({
    connectionString: 'postgresql://postgres:admin@localhost:5432/spmb'
});

const templates = [
    {
        template_key: 'test_message',
        template_name: 'Test Message',
        description: 'Pesan tes koneksi WhatsApp',
        message_body: 'Halo {{nama_lengkap}}, ini adalah pesan tes dari sistem SPMB. Jika Anda menerima pesan ini, berarti koneksi WhatsApp telah berhasil.',
        variables: ['nama_lengkap'],
        is_active: true
    },
    {
        template_key: 'registration_success',
        template_name: 'Welcome Message - Registration Success',
        description: 'Pesan selamat datang saat siswa berhasil membuat akun',
        message_body: 'Halo {{nama_lengkap}}, selamat datang di Portal SPMB! Akun Anda telah berhasil dibuat. Silakan login untuk melengkapi data pendaftaran Anda.',
        variables: ['nama_lengkap'],
        is_active: true
    },
    {
        template_key: 'application_submitted',
        template_name: 'Pendaftaran Disubmit (Submitted)',
        description: 'Notifikasi saat formulir pendaftaran berhasil disubmit',
        message_body: 'Halo {{nama_lengkap}}, formulir pendaftaran Anda (No. Registrasi: {{registration_number}}) telah berhasil disubmit dan saat ini sedang dalam proses verifikasi oleh panitia. Terima kasih.',
        variables: ['nama_lengkap', 'registration_number'],
        is_active: true
    },
    {
        template_key: 'application_approved',
        template_name: 'Pendaftaran Disetujui (Approved)',
        description: 'Notifikasi saat pendaftaran disetujui',
        message_body: 'Selamat {{nama_lengkap}}! Pendaftaran Anda (No. Registrasi: {{registration_number}}) telah DISETUJUI oleh panitia. Silakan cek dashboard Anda untuk langkah selanjutnya.',
        variables: ['nama_lengkap', 'registration_number'],
        is_active: true
    },
    {
        template_key: 'application_needs_revision',
        template_name: 'Pendaftaran Perlu Revisi (Needs Revision)',
        description: 'Notifikasi saat pendaftaran dikembalikan ke draft untuk revisi',
        message_body: 'Halo {{nama_lengkap}}, pendaftaran Anda (No. Registrasi: {{registration_number}}) memerlukan revisi. \n\nCatatan Admin:\n{{admin_comments}}\n\nSilakan login ke dashboard untuk memperbaiki data Anda.',
        variables: ['nama_lengkap', 'registration_number', 'admin_comments'],
        is_active: true
    },
    {
        template_key: 'application_rejected',
        template_name: 'Pendaftaran Ditolak (Rejected)',
        description: 'Notifikasi saat pendaftaran ditolak',
        message_body: 'Mohon maaf {{nama_lengkap}}, pendaftaran Anda (No. Registrasi: {{registration_number}}) DITOLAK. Silakan hubungi panitia untuk informasi lebih lanjut.',
        variables: ['nama_lengkap', 'registration_number'],
        is_active: true
    },
    {
        template_key: 'application_unlocked',
        template_name: 'Pendaftaran Dibuka Kembali (Unlocked)',
        description: 'Notifikasi saat pendaftaran di-unlock untuk revisi',
        message_body: 'Halo {{nama_lengkap}}, akses formulir pendaftaran Anda (No. Registrasi: {{registration_number}}) telah DIBUKA KEMBALI. Silakan perbarui data Anda sesuai dengan instruksi yang diberikan.',
        variables: ['nama_lengkap', 'registration_number'],
        is_active: true
    },
    {
        template_key: 'exam_results_available',
        template_name: 'Hasil Ujian Keluar (Exam Results Available)',
        description: 'Notifikasi saat hasil ujian sudah keluar',
        message_body: 'Halo {{nama_lengkap}}, hasil ujian untuk (No. Registrasi: {{registration_number}}) Anda telah keluar. Silakan login ke dashboard untuk melihat detail nilai Anda.',
        variables: ['nama_lengkap', 'registration_number'],
        is_active: true
    },
    {
        template_key: 'exam_submission_confirmation',
        template_name: 'Konfirmasi Pengumpulan Ujian (Exam Submission)',
        description: 'Notifikasi konfirmasi ujian disubmit',
        message_body: 'Halo {{nama_lengkap}}, jawaban ujian Anda (No. Registrasi: {{registration_number}}) telah berhasil disubmit. Nilai akan segera diproses oleh sistem.',
        variables: ['nama_lengkap', 'registration_number'],
        is_active: true
    },
    {
        template_key: 'interview_scheduled',
        template_name: 'Jadwal Interview (Interview Scheduled)',
        description: 'Notifikasi pengaturan jadwal interview',
        message_body: 'Halo {{nama_lengkap}}, jadwal interview Anda telah ditetapkan. \nTanggal: {{interview_date}}\nWaktu: {{interview_time}}\nLink/Lokasi: {{meeting_link}}\n\nMohon hadir tepat waktu. Terima kasih.',
        variables: ['nama_lengkap', 'interview_date', 'interview_time', 'meeting_link'],
        is_active: true
    },
    {
        template_key: 'payment_update',
        template_name: 'Update Pembayaran (Payment Status Update)',
        description: 'Notifikasi saat status pembayaran diperbarui',
        message_body: 'Halo {{nama_lengkap}}, status pembayaran Anda senilai {{amount}} untuk biaya pendaftaran telah diperbarui menjadi: {{status}}. Terima kasih.',
        variables: ['nama_lengkap', 'amount', 'status'],
        is_active: true
    },
    {
        template_key: 'registration_documents_available',
        template_name: 'Dokumen Tersedia (Documents Available)',
        description: 'Notifikasi ketersediaan surat/dokumen untuk didownload',
        message_body: 'Halo {{nama_lengkap}}, dokumen resmi pendaftaran Anda (No. Registrasi: {{registration_number}}) kini telah tersedia untuk diunduh. Silakan login ke portal dan masuk ke menu Surat Pendaftaran.',
        variables: ['nama_lengkap', 'registration_number'],
        is_active: true
    }
];

async function insertTemplates() {
    try {
        await client.connect();
        console.log('Connected to DB');
        await client.query('ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS description TEXT');

        for (const template of templates) {
            const varsJson = JSON.stringify(template.variables);
            const query = `
        INSERT INTO whatsapp_templates (template_key, template_name, description, message_body, variables, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (template_key) DO UPDATE SET
          template_name = EXCLUDED.template_name,
          description = EXCLUDED.description,
          message_body = EXCLUDED.message_body,
          variables = EXCLUDED.variables,
          is_active = EXCLUDED.is_active;
      `;

            await client.query(query, [
                template.template_key,
                template.template_name,
                template.description,
                template.message_body,
                varsJson,
                template.is_active
            ]);
            console.log(`Upserted template: ${template.template_key}`);
        }

        console.log('All templates handled successfully.');
    } catch (err) {
        console.error('Error inserting templates:', err);
    } finally {
        await client.end();
    }
}

insertTemplates();
