/*
  # Add Exam and Document WhatsApp Notification Templates

  1. New Templates
    - `exam_submitted` - Notification when student submits an exam
      - Confirms exam submission
      - Informs student to wait for grading
      - Variables: nama_lengkap, exam_title, tanggal_submit, registration_number

    - `exam_graded` - Notification when exam grading is completed
      - Notifies student that results are ready
      - Provides result summary
      - Includes instructions to view full results
      - Variables: nama_lengkap, exam_title, total_points, max_points, percentage, status_kelulusan

    - `documents_available` - Notification when registration documents become available
      - Informs student about available documents
      - Provides step-by-step access instructions
      - Variables: nama_lengkap, document_count, access_instructions

  2. Notes
    - These templates extend the existing WhatsApp notification system
    - All templates are active by default
    - Messages are in Indonesian for consistency with existing templates
*/

-- Insert new WhatsApp templates for exam and document notifications
INSERT INTO whatsapp_templates (template_key, template_name, message_body, variables, is_active)
VALUES
  (
    'exam_submitted',
    'Exam Submission Confirmation',
    E'Ujian Berhasil Dikumpulkan!\n\nHalo {{nama_lengkap}},\n\nUjian Anda telah berhasil dikumpulkan:\n\n📝 Ujian: {{exam_title}}\n📅 Waktu Pengumpulan: {{tanggal_submit}}\n🔢 No. Registrasi: {{registration_number}}\n\n✅ Jawaban Anda telah tersimpan dengan aman.\n\nHarap tunggu proses penilaian dari admin. Anda akan mendapat notifikasi ketika hasil ujian sudah tersedia.\n\nTerima kasih.',
    '["nama_lengkap", "exam_title", "tanggal_submit", "registration_number"]'::jsonb,
    true
  ),
  (
    'exam_graded',
    'Exam Results Available',
    E'Hasil Ujian Tersedia! 🎓\n\nHalo {{nama_lengkap}},\n\nHasil ujian Anda telah selesai dinilai:\n\n📝 Ujian: {{exam_title}}\n📊 Nilai: {{total_points}}/{{max_points}} ({{percentage}}%)\n✨ Status: {{status_kelulusan}}\n\n📥 Cara Mengunduh Hasil Ujian:\n1. Login ke akun Anda\n2. Buka menu "Portal Ujian"\n3. Klik "Lihat Hasil" pada ujian terkait\n4. Unduh laporan hasil ujian dalam format PDF\n\nSelamat! Silakan cek dashboard Anda untuk detail lengkap.\n\nTerima kasih.',
    '["nama_lengkap", "exam_title", "total_points", "max_points", "percentage", "status_kelulusan"]'::jsonb,
    true
  ),
  (
    'documents_available',
    'Registration Documents Available',
    E'Dokumen Pendaftaran Tersedia! 📄\n\nHalo {{nama_lengkap}},\n\nDokumen pendaftaran Anda sudah tersedia untuk diunduh!\n\n📊 Jumlah Dokumen: {{document_count}}\n\n📥 Cara Mengunduh Dokumen:\n1. Login ke akun Anda di sistem SPMB\n2. Buka menu "Generate Dokumen" atau "Surat Saya"\n3. Pilih dokumen yang ingin diunduh\n4. Klik tombol "Unduh" atau "Generate"\n5. Dokumen akan terunduh dalam format PDF/DOCX\n\n{{access_instructions}}\n\n💡 Tips: Simpan dokumen Anda dengan baik untuk keperluan administrasi.\n\nJika mengalami kendala, silakan hubungi admin.\n\nTerima kasih.',
    '["nama_lengkap", "document_count", "access_instructions"]'::jsonb,
    true
  )
ON CONFLICT (template_key) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE whatsapp_templates IS 'Stores WhatsApp message templates for different notification types including exam and document notifications';
