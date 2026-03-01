import React from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  draft: {
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    icon: <FileText className="h-4 w-4" />,
    label: 'Draft'
  },
  submitted: {
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: <Clock className="h-4 w-4" />,
    label: 'Menunggu Verifikasi'
  },
  approved: {
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Diterima'
  },
  rejected: {
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: <XCircle className="h-4 w-4" />,
    label: 'Ditolak'
  },
  review: {
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'Dalam Review'
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = statusConfig[status] || statusConfig.draft;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses[size]}`}>
      {config.icon}
      {config.label}
    </span>
  );
};
