import React from 'react';
import { MonitoringStatusBadge } from './MonitoringStatusBadge';

interface PaymentStatusCellProps {
  status: string | null;
  paidAmount: number | null;
  totalAmount: number | null;
  onClick: () => void;
}

export const PaymentStatusCell: React.FC<PaymentStatusCellProps> = ({
  status,
  paidAmount,
  totalAmount,
  onClick
}) => {
  if (!status) {
    return (
      <button
        onClick={onClick}
        className="text-left hover:bg-slate-50 rounded-lg p-2 transition-colors"
      >
        <span className="text-sm text-slate-500">Not Set</span>
      </button>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const paid = paidAmount || 0;
  const total = totalAmount || 0;
  const remaining = total - paid;

  return (
    <button
      onClick={onClick}
      className="text-left hover:bg-slate-50 rounded-lg p-2 transition-colors w-full"
    >
      <div className="flex flex-col gap-1">
        <MonitoringStatusBadge status={status} type="payment" />
        {status !== 'unpaid' && status !== 'waived' && (
          <div className="text-xs text-slate-600">
            {formatCurrency(paid)} / {formatCurrency(total)}
          </div>
        )}
        {status === 'partial' && remaining > 0 && (
          <div className="text-xs text-amber-600 font-medium">
            Sisa: {formatCurrency(remaining)}
          </div>
        )}
        {status === 'unpaid' && total > 0 && (
          <div className="text-xs text-slate-600">
            {formatCurrency(total)}
          </div>
        )}
      </div>
    </button>
  );
};
