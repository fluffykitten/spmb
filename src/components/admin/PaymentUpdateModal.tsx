import React, { useState, useEffect } from 'react';
import { X, DollarSign, Waves } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PaymentHistoryTimeline } from './PaymentHistoryTimeline';
import { sendWhatsAppNotification as sendWhatsAppNotificationHelper } from '../../lib/whatsappNotification';

interface PaymentUpdateModalProps {
  applicantId: string;
  applicantName: string;
  initialPaymentType?: 'entrance_fee' | 'administration_fee';
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentRecord {
  id: string;
  payment_status: string;
  total_amount: number;
  paid_amount: number;
  payment_method: string | null;
  payment_date: string | null;
  payment_notes: string | null;
}

export const PaymentUpdateModal: React.FC<PaymentUpdateModalProps> = ({
  applicantId,
  applicantName,
  initialPaymentType = 'entrance_fee',
  onClose,
  onSuccess
}) => {
  const [activePaymentType, setActivePaymentType] = useState<'entrance_fee' | 'administration_fee'>(initialPaymentType);
  const [paymentRecords, setPaymentRecords] = useState<{
    entrance_fee: PaymentRecord | null;
    administration_fee: PaymentRecord | null;
  }>({
    entrance_fee: null,
    administration_fee: null
  });
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchName, setBatchName] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [sendWhatsAppNotification, setSendWhatsAppNotification] = useState(true);

  const [formData, setFormData] = useState({
    totalAmount: 0,
    status: 'unpaid' as 'unpaid' | 'partial' | 'paid' | 'waived',
    amountPaid: 0,
    paymentMethod: 'cash' as 'cash' | 'transfer' | 'other',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    fetchPaymentRecords();
  }, [applicantId]);

  useEffect(() => {
    fetchPaymentHistory();
  }, [activePaymentType]);

  const fetchPaymentRecords = async () => {
    try {
      setLoading(true);

      const { data: applicantData } = await supabase
        .from('applicants')
        .select('registration_batch_id, registration_batches(name), dynamic_data')
        .eq('id', applicantId)
        .maybeSingle();

      if (applicantData?.registration_batches) {
        setBatchName((applicantData.registration_batches as any).name);
      }

      if (applicantData?.dynamic_data) {
        const dynamicData = applicantData.dynamic_data as any;
        const phone = dynamicData.no_telepon || dynamicData.no_hp || dynamicData.telepon || dynamicData.phone_number || dynamicData.phone || null;
        setPhoneNumber(phone);
        console.log('[PaymentUpdateModal] Student phone number:', phone);
      }

      const { data, error } = await supabase
        .from('payment_records')
        .select('*')
        .eq('applicant_id', applicantId);

      if (error) throw error;

      const records: any = {
        entrance_fee: null,
        administration_fee: null
      };

      (data || []).forEach((record: any) => {
        records[record.payment_type] = record;
      });

      setPaymentRecords(records);

      const currentRecord = records[activePaymentType];
      if (currentRecord) {
        setFormData({
          totalAmount: currentRecord.total_amount,
          status: currentRecord.payment_status,
          amountPaid: 0,
          paymentMethod: currentRecord.payment_method || 'cash',
          paymentDate: currentRecord.payment_date
            ? new Date(currentRecord.payment_date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          notes: currentRecord.payment_notes || ''
        });
      }
    } catch (error) {
      console.error('[PaymentUpdateModal] Error fetching payment records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      setHistoryLoading(true);
      const { data, error } = await supabase.rpc('admin_get_payment_history', {
        p_applicant_id: applicantId,
        p_payment_type: activePaymentType
      });

      if (error) throw error;

      setPaymentHistory(data || []);
    } catch (error) {
      console.error('[PaymentUpdateModal] Error fetching payment history:', error);
      setPaymentHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlePaymentTypeChange = (type: 'entrance_fee' | 'administration_fee') => {
    setActivePaymentType(type);
    const record = paymentRecords[type];
    if (record) {
      setFormData({
        totalAmount: record.total_amount,
        status: record.payment_status as any,
        amountPaid: 0,
        paymentMethod: (record.payment_method || 'cash') as 'cash' | 'transfer' | 'other',
        paymentDate: record.payment_date
          ? new Date(record.payment_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        notes: record.payment_notes || ''
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      console.log('[PaymentUpdateModal] Updating payment:', {
        applicantId,
        paymentType: activePaymentType,
        formData
      });

      const { error } = await supabase.rpc('admin_update_payment_status', {
        p_applicant_id: applicantId,
        p_payment_type: activePaymentType,
        p_new_status: formData.status,
        p_amount_paid: formData.amountPaid,
        p_method: formData.paymentMethod,
        p_payment_date: formData.paymentDate,
        p_notes: formData.notes || null
      });

      if (error) throw error;

      console.log('[PaymentUpdateModal] Payment updated successfully');

      if (sendWhatsAppNotification && formData.amountPaid > 0) {
        try {
          const paymentTypeLabel = activePaymentType === 'entrance_fee' ? 'Biaya Masuk' : 'Biaya Administrasi';
          const statusLabels = {
            'unpaid': 'Belum Dibayar',
            'partial': 'Dibayar Sebagian',
            'paid': 'Lunas',
            'waived': 'Dibebaskan'
          };
          const statusLabel = statusLabels[formData.status] || formData.status;
          const methodLabels = {
            'cash': 'Tunai',
            'transfer': 'Transfer Bank',
            'other': 'Lainnya'
          };
          const methodLabel = methodLabels[formData.paymentMethod] || formData.paymentMethod;

          const formatAmountOnly = (amount: number) => {
            return new Intl.NumberFormat('id-ID', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(amount);
          };

          console.log('[PaymentUpdateModal] Sending WhatsApp notification:', {
            phone: phoneNumber || 'profile_number',
            templateKey: 'payment_status_updated',
            variables: {
              student_name: applicantName,
              payment_type_label: paymentTypeLabel,
              status_label: statusLabel,
              amount_paid: formatAmountOnly(formData.amountPaid),
              total_amount: formatAmountOnly(currentTotal),
              remaining_amount: formatAmountOnly(remainingAfterPayment),
              payment_date: new Date(formData.paymentDate).toLocaleDateString('id-ID'),
              payment_method: methodLabel
            }
          });

          const result = await sendWhatsAppNotificationHelper({
            phone: phoneNumber || '',
            templateKey: 'payment_status_updated',
            variables: {
              student_name: applicantName,
              payment_type_label: paymentTypeLabel,
              status_label: statusLabel,
              amount_paid: formatAmountOnly(formData.amountPaid),
              total_amount: formatAmountOnly(currentTotal),
              remaining_amount: formatAmountOnly(remainingAfterPayment),
              payment_date: new Date(formData.paymentDate).toLocaleDateString('id-ID'),
              payment_method: methodLabel
            },
            applicantId
          });

          if (result.success) {
            console.log('[PaymentUpdateModal] WhatsApp notification sent successfully');
          } else {
            console.error('[PaymentUpdateModal] WhatsApp notification failed:', result.error);
            alert(`Gagal mengirim WhatsApp: ${result.error}`);
          }
        } catch (notifError) {
          console.error('[PaymentUpdateModal] Failed to send WhatsApp notification:', notifError);
        }
      }

      await fetchPaymentRecords();
      await fetchPaymentHistory();
      setFormData(prev => ({ ...prev, amountPaid: 0, notes: '' }));
      onSuccess();
    } catch (error: any) {
      console.error('[PaymentUpdateModal] Error updating payment:', error);
      alert('Failed to update payment: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const currentRecord = paymentRecords[activePaymentType];
  const currentPaid = currentRecord?.paid_amount || 0;
  const currentTotal = currentRecord?.total_amount || 0;
  const remaining = currentTotal - currentPaid;
  const newPaidPreview = currentPaid + (formData.amountPaid || 0);
  const remainingAfterPayment = Math.max(0, currentTotal - newPaidPreview);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-slate-600">Loading payment information...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Payment Management</h3>
            <p className="text-sm text-slate-600 mt-1">{applicantName}</p>
            {batchName && (
              <div className="flex items-center gap-2 mt-2">
                <Waves className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{batchName}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => handlePaymentTypeChange('entrance_fee')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${activePaymentType === 'entrance_fee'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <div className="font-medium">Biaya Masuk</div>
                {paymentRecords.entrance_fee && (
                  <div className="text-sm mt-1">
                    {formatCurrency(paymentRecords.entrance_fee.paid_amount)} /{' '}
                    {formatCurrency(paymentRecords.entrance_fee.total_amount)}
                  </div>
                )}
              </button>
              <button
                onClick={() => handlePaymentTypeChange('administration_fee')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${activePaymentType === 'administration_fee'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <div className="font-medium">Biaya Administrasi</div>
                {paymentRecords.administration_fee && (
                  <div className="text-sm mt-1">
                    {formatCurrency(paymentRecords.administration_fee.paid_amount)} /{' '}
                    {formatCurrency(paymentRecords.administration_fee.total_amount)}
                  </div>
                )}
              </button>
            </div>

            {!currentRecord ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-amber-800">
                  Payment record not initialized. Please set up the payment record first.
                </p>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h4 className="font-medium text-slate-800 mb-3">Current Status</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-600">Total Amount</div>
                        <div className="font-medium text-slate-800">{formatCurrency(currentTotal)}</div>
                      </div>
                      <div>
                        <div className="text-slate-600">Paid Amount</div>
                        <div className="font-medium text-emerald-600">{formatCurrency(currentPaid)}</div>
                      </div>
                      <div>
                        <div className="text-slate-600">Remaining</div>
                        <div className="font-medium text-amber-600">{formatCurrency(currentTotal - currentPaid)}</div>
                      </div>
                      <div>
                        <div className="text-slate-600">Status</div>
                        <div className="font-medium text-slate-800 capitalize">{currentRecord.payment_status}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Payment Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                      <option value="waived">Waived</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Amount to Add
                    </label>
                    <input
                      type="number"
                      value={formData.amountPaid}
                      onChange={(e) => setFormData({ ...formData, amountPaid: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      min="0"
                      max={remaining}
                      step="1000"
                      placeholder="0"
                    />
                    {formData.amountPaid > 0 && (
                      <p className="text-sm text-slate-600 mt-1">
                        New total: {formatCurrency(newPaidPreview)} (Remaining: {formatCurrency(remainingAfterPayment)})
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="cash">Tunai (Cash)</option>
                      <option value="transfer">Transfer Bank</option>
                      <option value="other">Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      value={formData.paymentDate}
                      onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      rows={3}
                      placeholder="Additional notes (optional)"
                    />
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="send_whatsapp"
                      checked={sendWhatsAppNotification}
                      onChange={(e) => setSendWhatsAppNotification(e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="send_whatsapp" className="text-sm font-medium text-blue-900 cursor-pointer flex-1">
                      Kirim notifikasi WhatsApp ke siswa
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={saving || (formData.amountPaid <= 0 && formData.status !== 'waived')}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    {saving ? 'Updating...' : 'Update Payment'}
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <PaymentHistoryTimeline history={paymentHistory} loading={historyLoading} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
