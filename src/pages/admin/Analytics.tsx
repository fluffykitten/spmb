import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Users, Clock, CheckCircle, X as XCircle, FileText, Calendar, Download } from 'lucide-react';

interface AnalyticsData {
  totalApplicants: number;
  pending: number;
  approved: number;
  rejected: number;
  averageProcessingDays: number;
  dailyApplications: { date: string; count: number }[];
  statusDistribution: { status: string; count: number; percentage: number }[];
  monthlyTrend: { month: string; count: number }[];
}

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData>({
    totalApplicants: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    averageProcessingDays: 0,
    dailyApplications: [],
    statusDistribution: [],
    monthlyTrend: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      const { data: applicants, error } = await supabase
        .from('applicants')
        .select('*')
        .gte('created_at', `${dateRange.from}T00:00:00`)
        .lte('created_at', `${dateRange.to}T23:59:59`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const total = applicants?.length || 0;
      const pending = applicants?.filter(a => ['draft', 'submitted', 'review'].includes(a.status)).length || 0;
      const approved = applicants?.filter(a => a.status === 'approved').length || 0;
      const rejected = applicants?.filter(a => a.status === 'rejected').length || 0;

      const processedApplicants = applicants?.filter(a =>
        ['approved', 'rejected'].includes(a.status)
      ) || [];

      const avgDays = processedApplicants.length > 0
        ? Math.round(
            processedApplicants.reduce((sum, a) => {
              const created = new Date(a.created_at).getTime();
              const updated = new Date(a.updated_at).getTime();
              return sum + (updated - created) / (1000 * 60 * 60 * 24);
            }, 0) / processedApplicants.length
          )
        : 0;

      const dailyMap = new Map<string, number>();
      applicants?.forEach(a => {
        const date = new Date(a.created_at).toISOString().split('T')[0];
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      });

      const dailyApplications = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const statusMap = new Map<string, number>();
      applicants?.forEach(a => {
        statusMap.set(a.status, (statusMap.get(a.status) || 0) + 1);
      });

      const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }));

      const monthlyMap = new Map<string, number>();
      applicants?.forEach(a => {
        const month = new Date(a.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' });
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
      });

      const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count }));

      setData({
        totalApplicants: total,
        pending,
        approved,
        rejected,
        averageProcessingDays: avgDays,
        dailyApplications,
        statusDistribution,
        monthlyTrend
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptanceRate = data.totalApplicants > 0
    ? ((data.approved / data.totalApplicants) * 100).toFixed(1)
    : '0';

  const rejectionRate = data.totalApplicants > 0
    ? ((data.rejected / data.totalApplicants) * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Analytics & Reports</h2>
          <p className="text-slate-600 mt-1">Analisis data pendaftar dan tren aplikasi</p>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-300 px-4 py-2">
            <Calendar className="h-4 w-4 text-slate-600" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="border-none outline-none text-sm"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="border-none outline-none text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Users className="h-8 w-8 opacity-80" />
            <TrendingUp className="h-5 w-5 opacity-60" />
          </div>
          <div className="text-3xl font-bold mb-1">{data.totalApplicants}</div>
          <div className="text-blue-100">Total Pendaftar</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="h-8 w-8 opacity-80" />
            <div className="text-sm opacity-80">{acceptanceRate}%</div>
          </div>
          <div className="text-3xl font-bold mb-1">{data.approved}</div>
          <div className="text-emerald-100">Diterima</div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Clock className="h-8 w-8 opacity-80" />
            <div className="text-sm opacity-80">days</div>
          </div>
          <div className="text-3xl font-bold mb-1">{data.averageProcessingDays}</div>
          <div className="text-amber-100">Avg. Processing Time</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <XCircle className="h-8 w-8 opacity-80" />
            <div className="text-sm opacity-80">{rejectionRate}%</div>
          </div>
          <div className="text-3xl font-bold mb-1">{data.rejected}</div>
          <div className="text-red-100">Ditolak</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Status Distribution</h3>
          <div className="space-y-4">
            {data.statusDistribution.map((item) => {
              const statusColors: Record<string, { bg: string; text: string }> = {
                draft: { bg: 'bg-slate-500', text: 'text-slate-700' },
                submitted: { bg: 'bg-blue-500', text: 'text-blue-700' },
                review: { bg: 'bg-amber-500', text: 'text-amber-700' },
                approved: { bg: 'bg-emerald-500', text: 'text-emerald-700' },
                rejected: { bg: 'bg-red-500', text: 'text-red-700' }
              };

              const color = statusColors[item.status] || statusColors.draft;

              return (
                <div key={item.status}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium capitalize ${color.text}`}>
                      {item.status}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {item.count} ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${color.bg} transition-all duration-500`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Daily Applications</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.dailyApplications.length > 0 ? (
              data.dailyApplications.reverse().slice(0, 15).map((item) => (
                <div key={item.date} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700">
                    {new Date(item.date).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min((item.count / Math.max(...data.dailyApplications.map(d => d.count))) * 100, 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 w-8 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 py-8">No data available</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Monthly Trend</h3>
          {data.monthlyTrend.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-end gap-2 h-64">
                {data.monthlyTrend.map((item, index) => {
                  const maxCount = Math.max(...data.monthlyTrend.map(d => d.count));
                  const height = (item.count / maxCount) * 100;

                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-xs font-semibold text-slate-700">{item.count}</div>
                      <div className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-500 hover:from-blue-700 hover:to-blue-500"
                        style={{ height: `${height}%` }}
                      />
                      <div className="text-xs text-slate-600 text-center">{item.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">No data available</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Quick Stats</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-700 mb-1">Pending Applications</div>
              <div className="text-2xl font-bold text-blue-900">{data.pending}</div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg">
              <div className="text-sm text-emerald-700 mb-1">Acceptance Rate</div>
              <div className="text-2xl font-bold text-emerald-900">{acceptanceRate}%</div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="text-sm text-amber-700 mb-1">Avg. Processing</div>
              <div className="text-2xl font-bold text-amber-900">{data.averageProcessingDays} days</div>
            </div>

            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-sm text-red-700 mb-1">Rejection Rate</div>
              <div className="text-2xl font-bold text-red-900">{rejectionRate}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <FileText className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-2">Export Reports</h4>
            <p className="text-sm text-blue-700 mb-4">
              Download comprehensive reports with all metrics and trends for the selected date range.
            </p>
            <button
              onClick={() => alert('Report export functionality will generate PDF with all charts and data')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Full Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
