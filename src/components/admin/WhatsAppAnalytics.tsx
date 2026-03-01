import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Download, Loader, TrendingUp, TrendingDown, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { getWhatsAppStats } from '../../lib/whatsappNotification';

type Period = 'today' | 'week' | 'month';

interface TemplateStats {
  template_key: string;
  count: number;
}

interface StatusStats {
  status: string;
  count: number;
}

export const WhatsAppAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<Period>('today');
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, successRate: 0 });
  const [templateStats, setTemplateStats] = useState<TemplateStats[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const periodStats = await getWhatsAppStats(period);
      setStats(periodStats);

      const startDate = getStartDate(period);

      const { data: logs, error } = await supabase
        .from('whatsapp_logs')
        .select('message_type, status')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const templateCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {};

      (logs || []).forEach((log) => {
        templateCounts[log.message_type] = (templateCounts[log.message_type] || 0) + 1;
        statusCounts[log.status] = (statusCounts[log.status] || 0) + 1;
      });

      setTemplateStats(
        Object.entries(templateCounts)
          .map(([template_key, count]) => ({ template_key, count }))
          .sort((a, b) => b.count - a.count)
      );

      setStatusStats(
        Object.entries(statusCounts)
          .map(([status, count]) => ({ status, count }))
      );

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching analytics:', error);
      alert('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = (p: Period): Date => {
    const now = new Date();
    switch (p) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  };

  const exportToCSV = () => {
    const csvData = [
      ['WhatsApp Analytics Report'],
      ['Period', period],
      ['Generated', new Date().toLocaleString()],
      [''],
      ['Overall Statistics'],
      ['Total Messages', stats.total],
      ['Sent Successfully', stats.sent],
      ['Failed', stats.failed],
      ['Success Rate', `${stats.successRate.toFixed(2)}%`],
      [''],
      ['Template Statistics'],
      ['Template', 'Count'],
      ...templateStats.map(t => [t.template_key, t.count]),
      [''],
      ['Status Statistics'],
      ['Status', 'Count'],
      ...statusStats.map(s => [s.status, s.count])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">WhatsApp Analytics</h3>
            <p className="text-sm text-slate-600 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === p
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 text-slate-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <MessageSquare className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                <p className="text-sm text-blue-700">Total Messages</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-emerald-900">{stats.sent}</p>
                <p className="text-sm text-emerald-700">Sent Successfully</p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-900">{stats.failed}</p>
                <p className="text-sm text-red-700">Failed</p>
              </div>

              <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-6 border border-violet-200">
                <div className="flex items-center justify-between mb-2">
                  {stats.successRate >= 90 ? (
                    <TrendingUp className="h-8 w-8 text-violet-600" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-violet-600" />
                  )}
                </div>
                <p className="text-2xl font-bold text-violet-900">{stats.successRate.toFixed(1)}%</p>
                <p className="text-sm text-violet-700">Success Rate</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-50 rounded-xl p-6">
                <h4 className="text-md font-semibold text-slate-800 mb-4">Top Templates</h4>
                {templateStats.length > 0 ? (
                  <div className="space-y-3">
                    {templateStats.slice(0, 5).map((stat) => (
                      <div key={stat.template_key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700 font-mono">{stat.template_key}</span>
                          <span className="text-sm font-semibold text-slate-900">{stat.count}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-emerald-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${(stat.count / Math.max(...templateStats.map(t => t.count))) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No data available</p>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-6">
                <h4 className="text-md font-semibold text-slate-800 mb-4">Status Breakdown</h4>
                {statusStats.length > 0 ? (
                  <div className="space-y-3">
                    {statusStats.map((stat) => (
                      <div key={stat.status} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          {stat.status === 'sent' && <CheckCircle className="h-5 w-5 text-emerald-600" />}
                          {stat.status === 'failed' && <XCircle className="h-5 w-5 text-red-600" />}
                          {stat.status === 'pending' && <Loader className="h-5 w-5 text-amber-600" />}
                          <span className={`text-sm font-medium ${
                            stat.status === 'sent' ? 'text-emerald-700' :
                            stat.status === 'failed' ? 'text-red-700' :
                            'text-amber-700'
                          }`}>
                            {stat.status.charAt(0).toUpperCase() + stat.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-slate-900">{stat.count}</span>
                          <span className="text-xs text-slate-500">
                            ({((stat.count / stats.total) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">No data available</p>
                )}
              </div>
            </div>

            {templateStats.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-6 mt-6">
                <h4 className="text-md font-semibold text-slate-800 mb-4">All Templates</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-sm font-semibold text-slate-700">Template</th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-slate-700">Count</th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-slate-700">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateStats.map((stat) => (
                        <tr key={stat.template_key} className="border-b border-slate-100">
                          <td className="py-2 px-3 text-sm text-slate-700 font-mono">{stat.template_key}</td>
                          <td className="py-2 px-3 text-sm text-slate-900 text-right font-semibold">{stat.count}</td>
                          <td className="py-2 px-3 text-sm text-slate-600 text-right">
                            {((stat.count / stats.total) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
