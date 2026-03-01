import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Filter, Eye, RotateCcw, Download, Loader, X } from 'lucide-react';
import { WhatsAppLog, retryFailedNotification } from '../../lib/whatsappNotification';
import { format } from 'date-fns';

export const NotificationHistory: React.FC = () => {
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<WhatsAppLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchQuery, statusFilter, dateFrom, dateTo]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      alert('Failed to load notification history');
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (searchQuery) {
      filtered = filtered.filter(log =>
        log.recipient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.recipient_phone.includes(searchQuery) ||
        log.message_type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(log => log.status === statusFilter);
    }

    if (dateFrom) {
      filtered = filtered.filter(log =>
        new Date(log.created_at) >= new Date(dateFrom)
      );
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59);
      filtered = filtered.filter(log =>
        new Date(log.created_at) <= toDate
      );
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      sent: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-red-100 text-red-700',
      pending: 'bg-amber-100 text-amber-700'
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full font-medium ${styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleRetry = async (log: WhatsAppLog) => {
    if (!confirm('Retry sending this notification?')) return;

    try {
      setRetrying(log.id);
      const result = await retryFailedNotification(log.id);

      if (result.success) {
        alert('Notification resent successfully');
        await fetchLogs();
      } else {
        alert('Failed to retry: ' + result.error);
      }
    } catch (error) {
      console.error('Error retrying notification:', error);
      alert('Failed to retry notification');
    } finally {
      setRetrying(null);
    }
  };

  const exportToCSV = () => {
    const csvData = [
      ['Notification History Export'],
      ['Generated', new Date().toLocaleString()],
      ['Total Records', filteredLogs.length],
      [''],
      ['Timestamp', 'Recipient Name', 'Phone', 'Template', 'Status', 'Error Message'],
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.recipient_name || '',
        log.recipient_phone,
        log.message_type,
        log.status,
        log.error_message || ''
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader className="h-8 w-8 text-slate-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Notification History</h3>
            <p className="text-sm text-slate-600 mt-1">
              {filteredLogs.length} of {logs.length} notifications
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button
              onClick={exportToCSV}
              disabled={filteredLogs.length === 0}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Search className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or template..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Timestamp</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Recipient</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Template</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-sm text-slate-700">
                    {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-medium text-slate-800">{log.recipient_name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{log.recipient_phone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-mono text-slate-700">{log.message_type}</span>
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(log.status)}
                    {log.retry_count > 0 && (
                      <span className="ml-2 text-xs text-slate-500">
                        ({log.retry_count} retries)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {log.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(log)}
                          disabled={retrying === log.id}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
                          title="Retry"
                        >
                          {retrying === log.id ? (
                            <Loader className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {paginatedLogs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500">No notifications found</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Show:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-slate-600">per page</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onRetry={() => {
            handleRetry(selectedLog);
            setSelectedLog(null);
          }}
        />
      )}
    </div>
  );
};

interface LogDetailModalProps {
  log: WhatsAppLog;
  onClose: () => void;
  onRetry: () => void;
}

const LogDetailModal: React.FC<LogDetailModalProps> = ({ log, onClose, onRetry }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800">Notification Details</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Status</p>
              <div>{getStatusBadge(log.status)}</div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Created At</p>
              <p className="text-sm text-slate-800">
                {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
              </p>
            </div>
          </div>

          {log.sent_at && (
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Sent At</p>
              <p className="text-sm text-slate-800">
                {format(new Date(log.sent_at), 'MMM dd, yyyy HH:mm:ss')}
              </p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-slate-600 mb-1">Recipient Name</p>
            <p className="text-sm text-slate-800">{log.recipient_name || 'N/A'}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-600 mb-1">Phone Number</p>
            <p className="text-sm text-slate-800 font-mono">{log.recipient_phone}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-600 mb-1">Template</p>
            <p className="text-sm text-slate-800 font-mono">{log.message_type}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-600 mb-1">Message Body</p>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{log.message_body}</p>
            </div>
          </div>

          {log.error_message && (
            <div>
              <p className="text-sm font-medium text-red-600 mb-1">Error Message</p>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700">{log.error_message}</p>
              </div>
            </div>
          )}

          {log.retry_count > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Retry Count</p>
              <p className="text-sm text-slate-800">{log.retry_count}</p>
            </div>
          )}

          <div className="pt-4 flex gap-3 border-t border-slate-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            {log.status === 'failed' && (
              <button
                onClick={onRetry}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retry Notification
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const getStatusBadge = (status: string) => {
  const styles = {
    sent: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-700'
  };

  return (
    <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};
