import React from 'react';
import { Clock, DollarSign } from 'lucide-react';

interface PaymentHistoryEntry {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
  recorded_by: string;
  recorded_by_name: string | null;
  created_at: string;
}

interface PaymentHistoryTimelineProps {
  history: PaymentHistoryEntry[];
  loading: boolean;
}

export const PaymentHistoryTimeline: React.FC<PaymentHistoryTimelineProps> = ({ history, loading }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Tunai';
      case 'transfer':
        return 'Transfer';
      case 'other':
        return 'Lainnya';
      default:
        return method;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-slate-600">Loading history...</div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No payment history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-slate-800 mb-3">Payment History</h4>
      <div className="space-y-3">
        {history.map((entry, index) => (
          <div key={entry.id} className="relative pl-8 pb-4 last:pb-0">
            {index < history.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200" />
            )}
            <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <DollarSign className="h-3 w-3 text-blue-600" />
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-medium text-slate-800">
                    {entry.amount === 0 ? 'Payment Waived' : formatCurrency(entry.amount)}
                  </div>
                  <div className="text-xs text-slate-600">
                    {getPaymentMethodLabel(entry.payment_method)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-600">
                    {formatDate(entry.payment_date)}
                  </div>
                  {entry.recorded_by_name && (
                    <div className="text-xs text-slate-500">
                      by {entry.recorded_by_name}
                    </div>
                  )}
                </div>
              </div>
              {entry.notes && (
                <div className="text-sm text-slate-600 mt-2 border-t border-slate-200 pt-2">
                  {entry.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
