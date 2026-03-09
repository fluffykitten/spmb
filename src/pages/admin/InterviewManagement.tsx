import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, MapPin, Video, CheckCircle, XCircle, Edit2, User, AlertTriangle, RefreshCw, Mail, Send, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { sendWhatsAppNotification } from '../../lib/whatsappNotification';
import { FIELD_NAMES, getFieldValue } from '../../lib/fieldConstants';

interface InterviewRequest {
  id: string;
  applicant_id: string;
  proposed_date: string;
  proposed_time_start: string;
  proposed_time_end: string;
  proposed_type: 'online' | 'offline';
  student_notes: string | null;
  meeting_link: string | null;
  admin_notes: string | null;
  interviewer_id: string | null;
  status: 'pending_review' | 'revision_requested' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  revision_requested_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  applicant: {
    id: string;
    registration_number: string;
    dynamic_data: any;
  };
  interviewer?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface Interviewer {
  id: string;
  full_name: string;
  email: string;
  specialization: string | null;
  is_active: boolean;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  email_type: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export const InterviewManagement: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<InterviewRequest[]>([]);
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('pending_review');
  const [selectedRequest, setSelectedRequest] = useState<InterviewRequest | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [resendingEmail, setResendingEmail] = useState<{ [key: string]: boolean }>({});
  const [emailLogs, setEmailLogs] = useState<{ [key: string]: EmailLog[] }>({});
  const [showEmailLogs, setShowEmailLogs] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadData();

    // Subscribe to interviewer changes for live updates
    const interviewerSubscription = supabase
      .channel('interviewers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviewers'
        },
        () => {
          loadInterviewers();
        }
      )
      .subscribe();

    return () => {
      interviewerSubscription.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRequests(),
        loadInterviewers()
      ]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    const { data: requestsData, error } = await supabase
      .from('interview_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading requests:', error);
      alert('Error loading interview requests: ' + error.message);
      return;
    }

    if (!requestsData || requestsData.length === 0) {
      setRequests([]);
      return;
    }

    const applicantIds = [...new Set(requestsData.map(r => r.applicant_id))];
    const interviewerIds = [...new Set(requestsData.map(r => r.interviewer_id).filter(Boolean))];

    const { data: applicantsData } = await supabase
      .from('applicants')
      .select('id, registration_number, dynamic_data')
      .in('id', applicantIds);

    let interviewersData: any[] = [];
    if (interviewerIds.length > 0) {
      const { data } = await supabase
        .from('interviewers')
        .select('id, full_name, email')
        .in('id', interviewerIds);
      interviewersData = data || [];
    }

    const applicantsMap = new Map(applicantsData?.map(a => [a.id, a]) || []);
    const interviewersMap = new Map(interviewersData.map(i => [i.id, i]));

    const formatted = requestsData.map((item: any) => ({
      ...item,
      applicant: applicantsMap.get(item.applicant_id) || null,
      interviewer: item.interviewer_id ? interviewersMap.get(item.interviewer_id) : null
    }));

    setRequests(formatted as any);
  };

  const loadInterviewers = async () => {
    try {
      const { data, error } = await supabase
        .from('interviewers')
        .select('id, full_name, email, specialization, is_active')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error loading interviewers:', error);
        throw error;
      }

      setInterviewers(data || []);
    } catch (error) {
      console.error('Failed to load interviewers:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const loadEmailLogs = async (interviewRequestId: string) => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('interview_request_id', interviewRequestId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEmailLogs(prev => ({
        ...prev,
        [interviewRequestId]: data || []
      }));
    } catch (error) {
      console.error('Error loading email logs:', error);
    }
  };

  const handleResendEmail = async (request: InterviewRequest) => {
    if (!request.interviewer) {
      alert('Interviewer tidak ditemukan');
      return;
    }

    const confirmSend = confirm(
      `Kirim ulang email notifikasi ke ${request.interviewer.full_name} (${request.interviewer.email})?`
    );

    if (!confirmSend) return;

    setResendingEmail(prev => ({ ...prev, [request.id]: true }));

    try {
      const token = localStorage.getItem('auth_token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      if (!token) {
        throw new Error('Not authenticated');
      }

      const emailResponse = await fetch(
        `${apiBase}/api/wawancara/notify-interviewer`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            interview_request_id: request.id,
            interviewer_id: request.interviewer.id,
            interviewer_email: request.interviewer.email,
            interviewer_name: request.interviewer.full_name,
            student_name: getApplicantName(request.applicant),
            registration_number: request.applicant.registration_number,
            interview_date: format(new Date(request.proposed_date), 'EEEE, dd MMMM yyyy', { locale: localeId }),
            interview_time: `${request.proposed_time_start.substring(0, 5)} - ${request.proposed_time_end.substring(0, 5)}`,
            interview_type: request.proposed_type === 'online' ? 'Online' : 'Offline',
            meeting_link: request.meeting_link || undefined,
            admin_notes: request.admin_notes || undefined,
          }),
        }
      );

      const result = await emailResponse.json();

      if (result.success) {
        alert('Email berhasil dikirim ke interviewer!');
        await loadEmailLogs(request.id);
      } else {
        alert(`Gagal mengirim email: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Gagal mengirim email. Silakan coba lagi.');
    } finally {
      setResendingEmail(prev => ({ ...prev, [request.id]: false }));
    }
  };

  const toggleEmailLogs = async (requestId: string) => {
    const isCurrentlyShown = showEmailLogs[requestId];

    if (!isCurrentlyShown && !emailLogs[requestId]) {
      await loadEmailLogs(requestId);
    }

    setShowEmailLogs(prev => ({
      ...prev,
      [requestId]: !isCurrentlyShown
    }));
  };

  const handleReviewClick = (request: InterviewRequest) => {
    setSelectedRequest(request);
    setShowReviewModal(true);
  };

  const filteredRequests = filterStatus === 'all'
    ? requests
    : requests.filter(r => r.status === filterStatus);

  const getStatusBadge = (status: string) => {
    const config = {
      pending_review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Review', icon: Clock },
      revision_requested: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Revisi Diminta', icon: Edit2 },
      approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Disetujui', icon: CheckCircle },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Ditolak', icon: XCircle },
      completed: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Selesai', icon: CheckCircle },
      cancelled: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Dibatalkan', icon: XCircle }
    };
    const c = config[status as keyof typeof config] || config.pending_review;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        <Icon className="h-3.5 w-3.5" />
        {c.label}
      </span>
    );
  };

  const getApplicantName = (applicant: any): string => {
    const data = applicant.dynamic_data;
    return data?.full_name || data?.nama_lengkap || data?.name || 'Unknown';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Interview Management</h2>
          <p className="text-slate-600 mt-1">Review dan kelola permintaan interview dari siswa</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/interview-session/new')}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <ClipboardList className="h-4 w-4" />
            Mulai Wawancara Baru
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'pending_review', label: 'Pending Review' },
          { key: 'approved', label: 'Disetujui' },
          { key: 'revision_requested', label: 'Perlu Revisi' },
          { key: 'rejected', label: 'Ditolak' },
          { key: 'completed', label: 'Selesai' },
          { key: 'all', label: 'Semua' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-4 py-2 rounded-lg transition-colors ${filterStatus === key
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
          >
            {label}
            <span className="ml-2 font-semibold">
              ({key === 'all' ? requests.length : requests.filter(r => r.status === key).length})
            </span>
          </button>
        ))}
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Tidak ada permintaan interview</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div key={request.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{getApplicantName(request.applicant)}</h3>
                    <p className="text-sm text-slate-600">No. Reg: {request.applicant.registration_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(request.status)}
                  <span className="text-xs text-slate-500">
                    {format(new Date(request.created_at), 'dd MMM HH:mm')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase">Jadwal Diajukan</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(request.proposed_date), 'EEEE, dd MMM yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Clock className="h-4 w-4" />
                      <span>{request.proposed_time_start.substring(0, 5)} - {request.proposed_time_end.substring(0, 5)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      {request.proposed_type === 'online' ? (
                        <><Video className="h-4 w-4" /><span>Online</span></>
                      ) : (
                        <><MapPin className="h-4 w-4" /><span>Offline</span></>
                      )}
                    </div>
                  </div>
                </div>

                {request.student_notes && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase">Catatan Siswa</p>
                    <p className="text-sm text-slate-700">{request.student_notes}</p>
                  </div>
                )}

                {request.interviewer && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase">Interviewer</p>
                    <div className="text-sm text-slate-700">
                      <p className="font-medium">{request.interviewer.full_name}</p>
                      <p className="text-slate-600">{request.interviewer.email}</p>
                    </div>
                  </div>
                )}
              </div>

              {request.status === 'approved' && request.meeting_link && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-emerald-800 mb-1">Meeting Link:</p>
                  <a
                    href={request.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 underline break-all"
                  >
                    {request.meeting_link}
                  </a>
                </div>
              )}

              {request.admin_notes && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-slate-700 mb-1">Catatan Admin:</p>
                  <p className="text-sm text-slate-600">{request.admin_notes}</p>
                </div>
              )}

              {request.status === 'approved' && request.interviewer && (
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResendEmail(request)}
                      disabled={resendingEmail[request.id]}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendingEmail[request.id] ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Mengirim...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Kirim Ulang Email
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => toggleEmailLogs(request.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      Riwayat Email
                      {showEmailLogs[request.id] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {showEmailLogs[request.id] && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-3">Riwayat Pengiriman Email</h4>
                      {emailLogs[request.id] && emailLogs[request.id].length > 0 ? (
                        <div className="space-y-2">
                          {emailLogs[request.id].map((log) => (
                            <div key={log.id} className="bg-white rounded-lg p-3 border border-slate-200">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {log.status === 'sent' ? (
                                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  <span className={`text-xs font-medium uppercase ${log.status === 'sent' ? 'text-emerald-700' : 'text-red-700'
                                    }`}>
                                    {log.status}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500">
                                  {log.sent_at ? format(new Date(log.sent_at), 'dd MMM yyyy HH:mm') : format(new Date(log.created_at), 'dd MMM yyyy HH:mm')}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mb-1">
                                <span className="font-medium">Ke:</span> {log.recipient_email}
                              </p>
                              <p className="text-xs text-slate-600">
                                <span className="font-medium">Subject:</span> {log.subject}
                              </p>
                              {log.error_message && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                  <p className="text-xs text-red-700">
                                    <span className="font-medium">Error:</span> {log.error_message}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600 text-center py-4">
                          Belum ada riwayat email untuk interview ini
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {request.status === 'pending_review' && (
                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleReviewClick(request)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Review Permintaan
                  </button>
                </div>
              )}

              {(request.status === 'approved' || request.status === 'completed') && (
                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => navigate('/admin/interview-session/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Mulai Sesi Wawancara
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showReviewModal && selectedRequest && (
        <ReviewModal
          request={selectedRequest}
          interviewers={interviewers}
          onRefreshInterviewers={loadInterviewers}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedRequest(null);
          }}
          onSuccess={() => {
            setShowReviewModal(false);
            setSelectedRequest(null);
            loadRequests();
          }}
        />
      )}
    </div>
  );
};

interface ReviewModalProps {
  request: InterviewRequest;
  interviewers: Interviewer[];
  onRefreshInterviewers: () => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ request, interviewers, onRefreshInterviewers, onClose, onSuccess }) => {
  const [action, setAction] = useState<'approve' | 'revision' | 'reject' | null>(null);
  const [formData, setFormData] = useState({
    interviewer_id: '',
    meeting_link: '',
    admin_notes: '',
    revision_notes: '',
    rejection_reason: '',
    send_email: true
  });
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingInterviewers, setLoadingInterviewers] = useState(false);

  useEffect(() => {
    if (action === 'approve') {
      // Refresh interviewer list when approve is selected
      const refreshAndCheck = async () => {
        setLoadingInterviewers(true);
        await onRefreshInterviewers();
        setLoadingInterviewers(false);
      };
      refreshAndCheck();
    }
  }, [action]);

  useEffect(() => {
    if (action === 'approve' && formData.interviewer_id) {
      checkConflicts();
    }
  }, [formData.interviewer_id]);

  const checkConflicts = async () => {
    if (!formData.interviewer_id) return;

    setCheckingConflict(true);
    try {
      const { data, error } = await supabase.rpc('check_interview_time_conflict', {
        p_interviewer_id: formData.interviewer_id,
        p_proposed_date: request.proposed_date,
        p_start_time: request.proposed_time_start,
        p_end_time: request.proposed_time_end,
        p_exclude_request_id: request.id
      });

      if (!error && data && data.length > 0) {
        if (data[0].has_conflict) {
          setConflicts(data[0].conflicting_times || []);
        } else {
          setConflicts([]);
        }
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleSubmit = async () => {
    if (action === 'approve') {
      if (!formData.interviewer_id) {
        alert('Pilih interviewer terlebih dahulu');
        return;
      }
      if (request.proposed_type === 'online' && !formData.meeting_link) {
        alert('Meeting link wajib diisi untuk interview online');
        return;
      }
      if (conflicts.length > 0) {
        if (!confirm('Ada konflik jadwal. Apakah tetap ingin approve?')) {
          return;
        }
      }
    }

    if (action === 'revision' && !formData.revision_notes) {
      alert('Isi alasan revisi');
      return;
    }

    if (action === 'reject' && !formData.rejection_reason) {
      alert('Isi alasan penolakan');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let updateData: any = {};

      if (action === 'approve') {
        updateData = {
          status: 'approved',
          interviewer_id: formData.interviewer_id,
          meeting_link: formData.meeting_link || null,
          admin_notes: formData.admin_notes || null,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        };
      } else if (action === 'revision') {
        updateData = {
          status: 'revision_requested',
          revision_requested_notes: formData.revision_notes
        };
      } else if (action === 'reject') {
        updateData = {
          status: 'rejected',
          rejection_reason: formData.rejection_reason,
          rejected_by: user.id,
          rejected_at: new Date().toISOString()
        };
      }

      const { error } = await supabase
        .from('interview_requests')
        .update(updateData)
        .eq('id', request.id);

      if (error) throw error;

      if (action === 'approve') {
        // Auto-create wawancara interview record
        try {
          const token = localStorage.getItem('auth_token');
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
          const wawancaraRes = await fetch(`${apiBase}/api/wawancara/interviews/from-request`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              applicant_id: request.applicant_id,
              interview_request_id: request.id
            })
          });
          const wawancaraResult = await wawancaraRes.json();
          if (wawancaraResult.error) {
            console.error('Failed to create wawancara record:', wawancaraResult.error);
          } else {
            console.log('[InterviewManagement] Wawancara record created:', wawancaraResult.data?.id);
          }
        } catch (wawancaraError) {
          console.error('Error creating wawancara record:', wawancaraError);
        }

        // Send WhatsApp notification
        try {
          const phoneNumber = getFieldValue(request.applicant.dynamic_data, FIELD_NAMES.NO_TELEPON);
          const studentName = getApplicantName(request.applicant);

          if (phoneNumber) {
            const interviewDate = format(new Date(request.proposed_date), 'EEEE, dd MMMM yyyy', { locale: localeId });
            const interviewTime = `${request.proposed_time_start.substring(0, 5)} - ${request.proposed_time_end.substring(0, 5)}`;
            const interviewType = request.proposed_type === 'online' ? 'Online' : 'Offline';

            let meetingDetails = '';
            if (request.proposed_type === 'online' && formData.meeting_link) {
              meetingDetails = `Link Meeting: ${formData.meeting_link}`;
            } else if (request.proposed_type === 'offline') {
              let schoolAddress = 'Alamat Sekolah';
              try {
                const { data: configData } = await supabase
                  .from('app_config')
                  .select('value')
                  .eq('key', 'school_address')
                  .single();
                if (configData && configData.value) {
                  schoolAddress = configData.value;
                }
              } catch (e) {
                console.error('Gagal mengambil alamat sekolah', e);
              }
              meetingDetails = `Lokasi: ${schoolAddress}`;
            }

            await sendWhatsAppNotification({
              phone: phoneNumber,
              templateKey: 'interview_scheduled',
              variables: {
                nama_lengkap: studentName,
                interview_date: interviewDate,
                interview_time: interviewTime,
                interview_type: interviewType,
                meeting_details: meetingDetails,
                admin_notes: formData.admin_notes || ''
              },
              applicantId: request.applicant_id
            });
          }
        } catch (whatsappError) {
          console.error('Error sending WhatsApp notification:', whatsappError);
        }

        // Send email and WA notification to interviewer
        const selectedInterviewer = interviewers.find(i => i.id === formData.interviewer_id);
        if (selectedInterviewer) {
          try {
            const token = localStorage.getItem('auth_token');
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';

            if (token) {
              const studentName = getApplicantName(request.applicant);
              await fetch(
                `${apiBase}/api/wawancara/notify-interviewer`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    interview_request_id: request.id,
                    interviewer_id: selectedInterviewer.id,
                    interviewer_email: selectedInterviewer.email,
                    interviewer_name: selectedInterviewer.full_name,
                    student_name: studentName,
                    registration_number: request.applicant.registration_number,
                    interview_date: format(new Date(request.proposed_date), 'EEEE, dd MMMM yyyy', { locale: localeId }),
                    interview_time: `${request.proposed_time_start.substring(0, 5)} - ${request.proposed_time_end.substring(0, 5)}`,
                    interview_type: request.proposed_type === 'online' ? 'Online' : 'Offline',
                    meeting_link: formData.meeting_link || undefined,
                    admin_notes: formData.admin_notes || undefined,
                  }),
                }
              );
              console.log('[InterviewManagement] Notified interviewer via Express API');
            }
          } catch (interviewerNotifyError) {
            console.error('Error notifying interviewer:', interviewerNotifyError);
          }
        }
      }

      alert('Berhasil memproses permintaan!');
      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      alert('Gagal memproses permintaan');
    } finally {
      setSubmitting(false);
    }
  };

  const getApplicantName = (applicant: any): string => {
    const data = applicant.dynamic_data;
    return data?.full_name || data?.nama_lengkap || data?.name || 'Unknown';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Review Permintaan Interview</h3>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Siswa</p>
                <p className="font-semibold text-slate-800">{getApplicantName(request.applicant)}</p>
                <p className="text-sm text-slate-600">No. Reg: {request.applicant.registration_number}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Jadwal</p>
                <p className="text-sm text-slate-700">{format(new Date(request.proposed_date), 'EEEE, dd MMM yyyy')}</p>
                <p className="text-sm text-slate-700">{request.proposed_time_start.substring(0, 5)} - {request.proposed_time_end.substring(0, 5)}</p>
                <p className="text-sm text-slate-700">{request.proposed_type === 'online' ? 'Online' : 'Offline'}</p>
              </div>
            </div>
            {request.student_notes && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Catatan Siswa</p>
                <p className="text-sm text-slate-700">{request.student_notes}</p>
              </div>
            )}
          </div>

          {!action ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Pilih Aksi:</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setAction('approve')}
                  className="p-4 border-2 border-emerald-300 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <CheckCircle className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                  <p className="font-medium text-emerald-700">Approve</p>
                </button>
                <button
                  onClick={() => setAction('revision')}
                  className="p-4 border-2 border-blue-300 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Edit2 className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="font-medium text-blue-700">Minta Revisi</p>
                </button>
                <button
                  onClick={() => setAction('reject')}
                  className="p-4 border-2 border-red-300 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <XCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
                  <p className="font-medium text-red-700">Tolak</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {action === 'approve' && 'Form Approval'}
                  {action === 'revision' && 'Form Permintaan Revisi'}
                  {action === 'reject' && 'Form Penolakan'}
                </p>
                <button
                  onClick={() => setAction(null)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Ganti Aksi
                </button>
              </div>

              {action === 'approve' && (
                <>
                  {loadingInterviewers && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                      Memperbarui daftar interviewer...
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Pilih Interviewer <span className="text-red-500">*</span>
                      {interviewers.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          ({interviewers.length} interviewer tersedia)
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.interviewer_id}
                      onChange={(e) => setFormData({ ...formData, interviewer_id: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={loadingInterviewers}
                    >
                      <option value="">
                        {interviewers.length === 0
                          ? '-- Tidak ada interviewer aktif --'
                          : '-- Pilih Interviewer --'}
                      </option>
                      {interviewers.map((interviewer) => (
                        <option key={interviewer.id} value={interviewer.id}>
                          {interviewer.full_name} ({interviewer.specialization || 'General'})
                        </option>
                      ))}
                    </select>
                    {interviewers.length === 0 && !loadingInterviewers && (
                      <p className="mt-2 text-sm text-amber-600">
                        Belum ada interviewer aktif. Silakan tambahkan interviewer di halaman Konfigurasi terlebih dahulu.
                      </p>
                    )}
                  </div>

                  {checkingConflict && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                      Checking conflicts...
                    </div>
                  )}

                  {conflicts.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800 mb-1">Konflik Jadwal Terdeteksi</p>
                          <p className="text-sm text-amber-700">
                            Interviewer sudah ada jadwal pada: {conflicts.join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {request.proposed_type === 'online' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Meeting Link <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={formData.meeting_link}
                        onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                        placeholder="https://zoom.us/j/..."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Catatan untuk Siswa (Opsional)
                    </label>
                    <textarea
                      value={formData.admin_notes}
                      onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                      rows={3}
                      placeholder="Informasi tambahan untuk siswa..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="send_email"
                      checked={formData.send_email}
                      onChange={(e) => setFormData({ ...formData, send_email: e.target.checked })}
                      className="mt-1 h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="send_email" className="flex-1 text-sm text-slate-700">
                      <span className="font-medium">Kirim Email Notifikasi ke Interviewer</span>
                      <p className="text-slate-600 mt-1">
                        Email akan dikirim ke interviewer yang dipilih dengan detail jadwal interview.
                      </p>
                    </label>
                  </div>
                </>
              )}

              {action === 'revision' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Alasan Revisi <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.revision_notes}
                    onChange={(e) => setFormData({ ...formData, revision_notes: e.target.value })}
                    rows={4}
                    placeholder="Contoh: Waktu bentrok dengan interview lain, silakan pilih jam 10:00 atau 14:00"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              {action === 'reject' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Alasan Penolakan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.rejection_reason}
                    onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                    rows={4}
                    placeholder="Jelaskan alasan penolakan..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          {action && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Konfirmasi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
