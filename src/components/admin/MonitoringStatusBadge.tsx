import React from 'react';

interface MonitoringStatusBadgeProps {
  status: string | null | undefined;
  type: 'form' | 'download' | 'interview' | 'exam' | 'payment';
}

export const MonitoringStatusBadge: React.FC<MonitoringStatusBadgeProps> = ({ status, type }) => {
  if (!status) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        N/A
      </span>
    );
  }

  const getStatusConfig = () => {
    switch (type) {
      case 'form':
        return {
          draft: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Draft' },
          submitted: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Submitted' },
          reviewed: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Reviewed' },
          approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
          rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
        };
      case 'download':
        return {
          none: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Not Started' },
          partial: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial' },
          complete: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Complete' },
        };
      case 'interview':
        return {
          not_scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Not Scheduled' },
          pending_review: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending' },
          revision_requested: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Revision' },
          approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
          scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Scheduled' },
          completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed' },
          rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
          cancelled: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Cancelled' },
          skipped: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Skipped' },
        };
      case 'exam':
        return {
          not_assigned: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Not Assigned' },
          in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
          completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Lulus' },
          failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Tidak Lulus' },
        };
      case 'payment':
        return {
          unpaid: { bg: 'bg-red-100', text: 'text-red-700', label: 'Unpaid' },
          partial: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial' },
          paid: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Paid' },
          waived: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Waived' },
        };
      default:
        return {};
    }
  };

  const statusConfig = getStatusConfig();
  const config = statusConfig[status.toLowerCase()] || {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    label: status
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};
