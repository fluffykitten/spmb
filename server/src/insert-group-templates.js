import pool from './db.js';

const templates = [
    {
        key: 'group_new_registration',
        name: 'Grup - Pendaftaran Baru',
        body: '📋 *Pendaftaran Baru*\nNama: {{nama_lengkap}}\nNo. Registrasi: {{registration_number}}\nTanggal: {{tanggal}}',
        vars: ['nama_lengkap', 'registration_number', 'tanggal']
    },
    {
        key: 'group_status_approved',
        name: 'Grup - Pendaftaran Disetujui',
        body: '✅ *Disetujui*\nNama: {{nama_lengkap}}\nNo. Registrasi: {{registration_number}}',
        vars: ['nama_lengkap', 'registration_number']
    },
    {
        key: 'group_status_rejected',
        name: 'Grup - Pendaftaran Ditolak',
        body: '❌ *Ditolak*\nNama: {{nama_lengkap}}\nNo. Registrasi: {{registration_number}}',
        vars: ['nama_lengkap', 'registration_number']
    },
    {
        key: 'group_status_revision',
        name: 'Grup - Perlu Revisi',
        body: '🔄 *Perlu Revisi*\nNama: {{nama_lengkap}}\nNo. Registrasi: {{registration_number}}\nCatatan: {{admin_comments}}',
        vars: ['nama_lengkap', 'registration_number', 'admin_comments']
    },
    {
        key: 'group_interview_scheduled',
        name: 'Grup - Interview Dijadwalkan',
        body: '📅 *Interview Dijadwalkan*\nNama: {{nama_lengkap}}\nTanggal: {{interview_date}}\nWaktu: {{interview_time}}',
        vars: ['nama_lengkap', 'interview_date', 'interview_time']
    }
];

async function run() {
    for (const t of templates) {
        await pool.query(
            `INSERT INTO whatsapp_templates (template_key, template_name, message_body, variables, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (template_key) DO UPDATE SET
         template_name = EXCLUDED.template_name,
         message_body = EXCLUDED.message_body,
         variables = EXCLUDED.variables,
         is_active = true`,
            [t.key, t.name, t.body, JSON.stringify(t.vars)]
        );
        console.log('Upserted:', t.key);
    }
    console.log('Done!');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
