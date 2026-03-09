import React from 'react';
import { CheckCircle, AlertCircle, DollarSign, Ban } from 'lucide-react';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getPaymentStatusConfig = (status: string) => {
  switch (status) {
    case 'paid':
      return {
        label: 'Lunas',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: CheckCircle,
        bgColor: 'bg-emerald-600',
      };
    case 'partial':
      return {
        label: 'Dibayar Sebagian',
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: DollarSign,
        bgColor: 'bg-amber-600',
      };
    case 'waived':
      return {
        label: 'Dibebaskan',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: Ban,
        bgColor: 'bg-blue-600',
      };
    case 'unpaid':
    default:
      return {
        label: 'Belum Dibayar',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: AlertCircle,
        bgColor: 'bg-red-600',
      };
  }
};

interface PaymentStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = getPaymentStatusConfig(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border font-medium ${config.color} ${sizeClasses[size]}`}>
      <Icon className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />
      {config.label}
    </span>
  );
};

interface PaymentProgressBarProps {
  paid: number;
  total: number;
  status: string;
  showPercentage?: boolean;
  height?: 'sm' | 'md' | 'lg';
}

export const PaymentProgressBar: React.FC<PaymentProgressBarProps> = ({
  paid,
  total,
  status,
  showPercentage = true,
  height = 'md',
}) => {
  const percentage = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;
  const config = getPaymentStatusConfig(status);

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="space-y-1.5">
      {showPercentage && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{formatCurrency(paid)} dari {formatCurrency(total)}</span>
          <span className="font-semibold text-slate-800">{percentage}%</span>
        </div>
      )}
      <div className={`bg-slate-100 rounded-full overflow-hidden ${heightClasses[height]}`}>
        <div
          className={`${config.bgColor} h-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface PaymentInfoItemProps {
  label: string;
  value: string | React.ReactNode;
  highlight?: boolean;
}

export const PaymentInfoItem: React.FC<PaymentInfoItemProps> = ({ label, value, highlight = false }) => {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? 'font-semibold' : ''}`}>
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm ${highlight ? 'text-slate-900 text-base' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
};

interface PaymentRecord {
  id: string;
  payment_type: 'entrance_fee' | 'administration_fee';
  payment_status: string;
  total_amount: number;
  paid_amount: number;
  payment_date?: string;
  payment_method?: string;
  payment_notes?: string;
}

interface PaymentInfoCardProps {
  paymentRecord: PaymentRecord;
  showHistory?: boolean;
  history?: Array<{
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    notes?: string;
  }>;
}

export const PaymentInfoCard: React.FC<PaymentInfoCardProps> = ({
  paymentRecord,
  showHistory = false,
  history = [],
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const config = getPaymentStatusConfig(paymentRecord.payment_status);
  const Icon = config.icon;

  const paymentTypeLabel = paymentRecord.payment_type === 'entrance_fee' ? 'Biaya Masuk' : 'Biaya Administrasi';
  const remaining = paymentRecord.total_amount - paymentRecord.paid_amount;

  return (
    <div className={`rounded-xl border p-4 ${config.color} bg-opacity-50`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">{paymentTypeLabel}</h4>
            <PaymentStatusBadge status={paymentRecord.payment_status} size="sm" />
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <PaymentProgressBar
          paid={paymentRecord.paid_amount}
          total={paymentRecord.total_amount}
          status={paymentRecord.payment_status}
          showPercentage={false}
        />

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-600">Dibayar:</span>
            <p className="font-semibold text-slate-900">{formatCurrency(paymentRecord.paid_amount)}</p>
          </div>
          <div>
            <span className="text-slate-600">Sisa:</span>
            <p className="font-semibold text-slate-900">{formatCurrency(remaining)}</p>
          </div>
        </div>
      </div>

      {paymentRecord.payment_date && (
        <div className="text-xs text-slate-600 border-t border-slate-200 pt-2 mt-2">
          <p>Pembayaran terakhir: {new Date(paymentRecord.payment_date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}</p>
          {paymentRecord.payment_method && (
            <p className="mt-0.5">Metode: {paymentRecord.payment_method === 'cash' ? 'Tunai' : paymentRecord.payment_method === 'transfer' ? 'Transfer' : 'Lainnya'}</p>
          )}
        </div>
      )}

      {showHistory && history.length > 0 && (
        <div className="border-t border-slate-200 pt-3 mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
          >
            {expanded ? '▼' : '▶'} Riwayat Pembayaran ({history.length})
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {history.map((item) => (
                <div key={item.id} className="bg-white rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                    <span className="text-xs text-slate-600">
                      {new Date(item.payment_date).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {item.payment_method === 'cash' ? 'Tunai' : item.payment_method === 'transfer' ? 'Transfer' : 'Lainnya'}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-slate-500 mt-1">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface PaymentSummaryCardProps {
  paymentRecords: PaymentRecord[];
  batchName?: string;
}

export const PaymentSummaryCard: React.FC<PaymentSummaryCardProps> = ({ paymentRecords, batchName }) => {
  const totalAmount = paymentRecords.reduce((sum, record) => sum + Number(record.total_amount || 0), 0);
  const totalPaid = paymentRecords.reduce((sum, record) => sum + Number(record.paid_amount || 0), 0);
  const totalRemaining = totalAmount - totalPaid;
  const percentage = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

  const allPaid = paymentRecords.every(r => r.payment_status === 'paid' || r.payment_status === 'waived');
  const anyPaid = paymentRecords.some(r => r.paid_amount > 0);

  const statusConfig = allPaid
    ? getPaymentStatusConfig('paid')
    : anyPaid
      ? getPaymentStatusConfig('partial')
      : getPaymentStatusConfig('unpaid');

  return (
    <div className={`rounded-xl border-2 p-6 ${statusConfig.color} bg-opacity-50`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-12 w-12 rounded-xl ${statusConfig.bgColor} flex items-center justify-center`}>
          <DollarSign className="h-7 w-7 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Total Pembayaran</h3>
          {batchName && (
            <p className="text-sm text-slate-600">Gelombang: {batchName}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4">
          <div className="space-y-2">
            <PaymentInfoItem
              label="Total Tagihan"
              value={formatCurrency(totalAmount)}
            />
            <PaymentInfoItem
              label="Total Dibayar"
              value={formatCurrency(totalPaid)}
              highlight
            />
            <PaymentInfoItem
              label="Sisa Tagihan"
              value={formatCurrency(totalRemaining)}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Progress Pembayaran</span>
            <span className="text-sm font-bold text-slate-900">{percentage}%</span>
          </div>
          <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`${statusConfig.bgColor} h-full transition-all duration-500`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {allPaid && (
          <div className={`${statusConfig.color} rounded-lg p-3 text-center`}>
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-900">Pembayaran Lunas</p>
          </div>
        )}
      </div>
    </div>
  );
};
