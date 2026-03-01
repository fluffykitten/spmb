/*
  # Add Payment Status Update WhatsApp Template

  1. New Templates
    - `payment_status_updated` - Template for notifying students about payment status changes

  2. Variables
    - student_name: Name of the student
    - payment_type_label: Label for payment type (Biaya Masuk/Biaya Administrasi)
    - status_label: Status label (Belum Dibayar/Dibayar Sebagian/Lunas/Dibebaskan)
    - amount_paid: Amount paid in this update
    - total_amount: Total amount for this payment type
    - remaining_amount: Remaining amount to be paid
    - payment_date: Date of payment
    - payment_method: Method of payment (Transfer/Tunai/Lainnya)
*/

INSERT INTO whatsapp_templates (template_key, template_name, message_body, variables, is_active)
VALUES (
  'payment_status_updated',
  'Notifikasi Update Status Pembayaran',
  'Halo {student_name},

Status pembayaran Anda telah diperbarui:

📋 Jenis: {payment_type_label}
✅ Status: {status_label}
💰 Dibayar: Rp {amount_paid}
📊 Total: Rp {total_amount}
💵 Sisa: Rp {remaining_amount}

📅 Tanggal: {payment_date}
💳 Metode: {payment_method}

Terima kasih atas pembayaran Anda. Untuk informasi lebih lanjut, silakan login ke portal pendaftaran atau hubungi admin.

Salam,
Tim SPMB',
  jsonb_build_array(
    'student_name',
    'payment_type_label',
    'status_label',
    'amount_paid',
    'total_amount',
    'remaining_amount',
    'payment_date',
    'payment_method'
  ),
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  message_body = EXCLUDED.message_body,
  variables = EXCLUDED.variables,
  updated_at = now();