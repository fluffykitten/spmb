import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { MonitoringStatusBadge } from './MonitoringStatusBadge';
import { DocumentDownloadStatus } from './DocumentDownloadStatus';
import { PaymentStatusCell } from './PaymentStatusCell';
import { PaymentUpdateModal } from './PaymentUpdateModal';
import { RefreshCw, Download, Search, Filter, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MonitoringData {
  profile_id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  applicant_id: string | null;
  registration_number: string | null;
  form_status: string | null;
  application_date: string | null;
  interview_status: string | null;
  interview_score: number | null;
  exam_status: string | null;
  exam_score: number | null;
  final_score: number | null;
  documents_downloaded_count: number;
  total_documents_count: number;
  latest_interview_request_status: string | null;
  exam_attempts_count: number;
  entrance_fee_status: string | null;
  entrance_fee_paid: number | null;
  entrance_fee_total: number | null;
  administration_fee_status: string | null;
  administration_fee_paid: number | null;
  administration_fee_total: number | null;
}

export const UserMonitoringTab: React.FC = () => {
  const [data, setData] = useState<MonitoringData[]>([]);
  const [wawancaraMap, setWawancaraMap] = useState<Record<string, { status: string; score: number }>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    formStatus: 'all',
    interviewStatus: 'all',
    examStatus: 'all',
    paymentStatus: 'all',
    documentStatus: 'all'
  });
  const [paymentModal, setPaymentModal] = useState<{
    applicantId: string;
    applicantName: string;
    paymentType: 'entrance_fee' | 'administration_fee';
  } | null>(null);

  useEffect(() => {
    fetchMonitoringData();
  }, []);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      console.log('[UserMonitoringTab] Fetching monitoring data...');

      const { data: monitoringData, error } = await supabase
        .from('user_monitoring_status')
        .select('*')
        .order('application_date', { ascending: false, nullsFirst: false });

      if (error) throw error;

      console.log('[UserMonitoringTab] Fetched monitoring data:', monitoringData?.length || 0);
      setData((monitoringData || []) as MonitoringData[]);

      // Fetch wawancara interview statuses
      try {
        const token = localStorage.getItem('auth_token');
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const wRes = await fetch(`${apiBase}/api/wawancara/interviews`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const wData = await wRes.json();
        const map: Record<string, { status: string; score: number }> = {};
        for (const w of (wData.data || [])) {
          if (w.applicant_id) {
            map[w.applicant_id] = { status: w.status, score: Number(w.weighted_score) || 0 };
          }
        }
        setWawancaraMap(map);
      } catch (wErr) {
        console.warn('[UserMonitoringTab] Could not fetch wawancara data:', wErr);
      }
    } catch (error) {
      console.error('[UserMonitoringTab] Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = data;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.full_name?.toLowerCase().includes(term) ||
          item.email?.toLowerCase().includes(term) ||
          item.registration_number?.toLowerCase().includes(term)
      );
    }

    if (filters.formStatus !== 'all') {
      result = result.filter((item) => item.form_status === filters.formStatus);
    }

    if (filters.interviewStatus !== 'all') {
      result = result.filter(
        (item) =>
          item.interview_status === filters.interviewStatus ||
          item.latest_interview_request_status === filters.interviewStatus
      );
    }

    if (filters.examStatus !== 'all') {
      result = result.filter((item) => item.exam_status === filters.examStatus);
    }

    if (filters.paymentStatus !== 'all') {
      if (filters.paymentStatus === 'unpaid') {
        result = result.filter(
          (item) =>
            item.entrance_fee_status === 'unpaid' || item.administration_fee_status === 'unpaid'
        );
      } else if (filters.paymentStatus === 'partial') {
        result = result.filter(
          (item) =>
            item.entrance_fee_status === 'partial' || item.administration_fee_status === 'partial'
        );
      } else if (filters.paymentStatus === 'paid') {
        result = result.filter(
          (item) =>
            item.entrance_fee_status === 'paid' && item.administration_fee_status === 'paid'
        );
      }
    }

    if (filters.documentStatus !== 'all') {
      if (filters.documentStatus === 'none') {
        result = result.filter((item) => item.documents_downloaded_count === 0);
      } else if (filters.documentStatus === 'partial') {
        result = result.filter(
          (item) =>
            item.documents_downloaded_count > 0 &&
            item.documents_downloaded_count < item.total_documents_count
        );
      } else if (filters.documentStatus === 'complete') {
        result = result.filter(
          (item) => item.documents_downloaded_count === item.total_documents_count
        );
      }
    }

    return result;
  }, [data, searchTerm, filters]);

  const clearFilters = () => {
    setFilters({
      formStatus: 'all',
      interviewStatus: 'all',
      examStatus: 'all',
      paymentStatus: 'all',
      documentStatus: 'all'
    });
    setSearchTerm('');
  };

  const exportToExcel = () => {
    const exportData = filteredData.map((item, index) => ({
      No: index + 1,
      'Full Name': item.full_name || 'N/A',
      Email: item.email || 'N/A',
      'Phone Number': item.phone_number || 'N/A',
      'Registration Number': item.registration_number || 'N/A',
      'Form Status': item.form_status || 'N/A',
      'Application Date': item.application_date
        ? new Date(item.application_date).toLocaleDateString('id-ID')
        : 'N/A',
      'Documents Downloaded': `${item.documents_downloaded_count}/${item.total_documents_count}`,
      'Interview Status': item.interview_status || 'N/A',
      'Interview Request': item.latest_interview_request_status || 'N/A',
      'Interview Score': item.interview_score || 'N/A',
      'Exam Status': item.exam_status || 'N/A',
      'Exam Attempts': item.exam_attempts_count || 0,
      'Exam Score': item.exam_score || 'N/A',
      'Entrance Fee Status': item.entrance_fee_status || 'N/A',
      'Entrance Fee Paid': item.entrance_fee_paid || 0,
      'Entrance Fee Total': item.entrance_fee_total || 0,
      'Admin Fee Status': item.administration_fee_status || 'N/A',
      'Admin Fee Paid': item.administration_fee_paid || 0,
      'Admin Fee Total': item.administration_fee_total || 0,
      'Final Score': item.final_score || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Monitoring');

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `User_Monitoring_${date}.xlsx`);
  };

  const activeFilterCount = Object.values(filters).filter((v) => v !== 'all').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading monitoring data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or registration number..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={fetchMonitoringData}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-slate-800">Filters</h4>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Form Status</label>
              <select
                value={filters.formStatus}
                onChange={(e) => setFilters({ ...filters, formStatus: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Interview Status</label>
              <select
                value={filters.interviewStatus}
                onChange={(e) => setFilters({ ...filters, interviewStatus: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All</option>
                <option value="not_scheduled">Not Scheduled</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Exam Status</label>
              <select
                value={filters.examStatus}
                onChange={(e) => setFilters({ ...filters, examStatus: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All</option>
                <option value="not_assigned">Not Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Status</label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All</option>
                <option value="unpaid">Has Unpaid</option>
                <option value="partial">Has Partial</option>
                <option value="paid">Fully Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Document Downloads</label>
              <select
                value={filters.documentStatus}
                onChange={(e) => setFilters({ ...filters, documentStatus: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All</option>
                <option value="none">Not Started</option>
                <option value="partial">Incomplete</option>
                <option value="complete">Complete</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">
                  No
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider sticky left-12 bg-slate-50 z-10 min-w-[200px]">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider min-w-[120px]">
                  Reg. Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider min-w-[120px]">
                  Form Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider min-w-[140px]">
                  Documents
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider min-w-[120px]">
                  Interview
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider min-w-[120px]">
                  Exam
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider min-w-[130px]">
                  Wawancara
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider min-w-[140px]">
                  Biaya Masuk
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider min-w-[140px]">
                  Biaya Admin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No data found
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.profile_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600 sticky left-0 bg-white group-hover:bg-slate-50">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 sticky left-12 bg-white group-hover:bg-slate-50">
                      <div>
                        <div className="font-medium text-slate-800">{item.full_name || 'N/A'}</div>
                        <div className="text-xs text-slate-500">{item.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {item.registration_number || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <MonitoringStatusBadge status={item.form_status} type="form" />
                    </td>
                    <td className="px-4 py-3">
                      {item.applicant_id ? (
                        <DocumentDownloadStatus
                          applicantId={item.applicant_id}
                          downloadedCount={item.documents_downloaded_count || 0}
                          totalCount={item.total_documents_count || 0}
                        />
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <MonitoringStatusBadge
                        status={item.latest_interview_request_status || item.interview_status}
                        type="interview"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <MonitoringStatusBadge status={item.exam_status} type="exam" />
                        {item.exam_score !== null && (
                          <span className="text-xs text-slate-600">Score: {item.exam_score}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.applicant_id && wawancaraMap[item.applicant_id] ? (
                        <div className="flex flex-col gap-1">
                          {wawancaraMap[item.applicant_id].status === 'completed' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              ✅ Selesai
                            </span>
                          ) : wawancaraMap[item.applicant_id].status === 'in_progress' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              🔄 Berlangsung
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              📝 Draft
                            </span>
                          )}
                          {wawancaraMap[item.applicant_id].status === 'completed' && (
                            <span className="text-xs text-slate-600">
                              Skor: {wawancaraMap[item.applicant_id].score.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Belum Ada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.applicant_id ? (
                        <PaymentStatusCell
                          status={item.entrance_fee_status}
                          paidAmount={item.entrance_fee_paid}
                          totalAmount={item.entrance_fee_total}
                          onClick={() =>
                            setPaymentModal({
                              applicantId: item.applicant_id!,
                              applicantName: item.full_name || 'Unknown',
                              paymentType: 'entrance_fee'
                            })
                          }
                        />
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.applicant_id ? (
                        <PaymentStatusCell
                          status={item.administration_fee_status}
                          paidAmount={item.administration_fee_paid}
                          totalAmount={item.administration_fee_total}
                          onClick={() =>
                            setPaymentModal({
                              applicantId: item.applicant_id!,
                              applicantName: item.full_name || 'Unknown',
                              paymentType: 'administration_fee'
                            })
                          }
                        />
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          Showing {filteredData.length} of {data.length} students
        </div>
      </div>

      {paymentModal && (
        <PaymentUpdateModal
          applicantId={paymentModal.applicantId}
          applicantName={paymentModal.applicantName}
          initialPaymentType={paymentModal.paymentType}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => {
            fetchMonitoringData();
          }}
        />
      )}
    </div>
  );
};
