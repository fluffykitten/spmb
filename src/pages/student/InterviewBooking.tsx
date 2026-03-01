import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Clock, MapPin, Video, CheckCircle, XCircle, AlertCircle, Edit2 } from 'lucide-react';
import { format, addDays } from 'date-fns';

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
  status: 'pending_review' | 'revision_requested' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  revision_requested_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface AppConfig {
  school_name: string;
  school_address: string;
  interview_location: string;
  interview_start_hour: string;
  interview_end_hour: string;
  interview_min_days_notice: number;
  interview_duration_options: number[];
}

export const InterviewBooking: React.FC = () => {
  const { user } = useAuth();
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [requests, setRequests] = useState<InterviewRequest[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<InterviewRequest | null>(null);

  const [formData, setFormData] = useState({
    proposed_date: '',
    proposed_time_start: '09:00',
    proposed_type: 'offline' as 'online' | 'offline',
    student_notes: ''
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: applicantData } = await supabase
        .from('applicants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (applicantData) {
        setApplicantId(applicantData.id);
        await Promise.all([
          loadConfig(),
          loadRequests(applicantData.id)
        ]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    const keys = [
      'school_name',
      'school_address',
      'interview_location',
      'interview_start_hour',
      'interview_end_hour',
      'interview_min_days_notice',
      'interview_duration_options'
    ];

    const { data } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', keys);

    if (data) {
      const configObj: any = {};
      data.forEach((item) => {
        const key = item.key;
        const value = item.value;

        if (typeof value === 'string') {
          configObj[key] = value;
        } else if (typeof value === 'number') {
          configObj[key] = value;
        } else if (Array.isArray(value)) {
          configObj[key] = value;
        } else {
          configObj[key] = value;
        }
      });
      setConfig(configObj as AppConfig);
    }
  };

  const loadRequests = async (appId: string) => {
    const { data } = await supabase
      .from('interview_requests')
      .select('*')
      .eq('applicant_id', appId)
      .order('created_at', { ascending: false });

    if (data) {
      setRequests(data);
    }
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const isDayDisabled = (dateString: string): boolean => {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay();

    return dayOfWeek === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!applicantId) {
      alert('Anda harus melengkapi form pendaftaran terlebih dahulu');
      return;
    }

    if (isDayDisabled(formData.proposed_date)) {
      alert('Tanggal tidak valid. Pastikan bukan hari Minggu.');
      return;
    }

    const proposed_time_end = calculateEndTime(formData.proposed_time_start, 60);

    try {
      if (editingRequest) {
        const { error } = await supabase
          .from('interview_requests')
          .update({
            proposed_date: formData.proposed_date,
            proposed_time_start: formData.proposed_time_start,
            proposed_time_end,
            proposed_type: formData.proposed_type,
            student_notes: formData.student_notes || null,
            status: 'pending_review'
          })
          .eq('id', editingRequest.id);

        if (error) throw error;
        alert('Permintaan interview berhasil diperbarui!');
      } else {
        const { error } = await supabase
          .from('interview_requests')
          .insert({
            applicant_id: applicantId,
            proposed_date: formData.proposed_date,
            proposed_time_start: formData.proposed_time_start,
            proposed_time_end,
            proposed_type: formData.proposed_type,
            student_notes: formData.student_notes || null,
            status: 'pending_review'
          });

        if (error) throw error;
        alert('Permintaan interview berhasil diajukan!');

        // Send group notification for interview scheduled
        const { sendWhatsAppGroupNotification } = await import('../../lib/whatsappNotification');
        sendWhatsAppGroupNotification({
          templateKey: 'group_interview_scheduled',
          variables: {
            nama_lengkap: user?.user_metadata?.full_name || 'Calon Siswa',
            interview_date: formData.proposed_date,
            interview_time: `${formData.proposed_time_start} - ${proposed_time_end}`
          }
        }).catch(err => {
          console.error('Error sending group notification:', err);
        });
      }

      setShowForm(false);
      setEditingRequest(null);
      resetForm();
      if (applicantId) loadRequests(applicantId);
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Gagal mengajukan permintaan');
    }
  };

  const resetForm = () => {
    setFormData({
      proposed_date: '',
      proposed_time_start: '09:00',
      proposed_type: 'offline',
      student_notes: ''
    });
  };

  const handleEdit = (request: InterviewRequest) => {
    setEditingRequest(request);

    const startTime = request.proposed_time_start.substring(0, 5);

    setFormData({
      proposed_date: request.proposed_date,
      proposed_time_start: startTime,
      proposed_type: request.proposed_type,
      student_notes: request.student_notes || ''
    });
    setShowForm(true);
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Yakin ingin membatalkan permintaan interview?')) return;

    try {
      const { error } = await supabase
        .from('interview_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);

      if (error) throw error;
      if (applicantId) loadRequests(applicantId);
    } catch (error) {
      console.error('Error:', error);
      alert('Gagal membatalkan permintaan');
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending_review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Menunggu Review', icon: Clock },
      revision_requested: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Perlu Revisi', icon: Edit2 },
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

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  const hasActiveRequest = requests.some(r =>
    ['pending_review', 'approved'].includes(r.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Permintaan Interview</h2>
          <p className="text-slate-600 mt-1">Ajukan jadwal interview yang sesuai untuk Anda</p>
        </div>
        {!showForm && !hasActiveRequest && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingRequest(null);
              resetForm();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ajukan Interview
          </button>
        )}
      </div>

      {config && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Lokasi Interview</h3>
              <p className="text-sm text-blue-800">
                {config.interview_location}<br />
                {config.school_name}<br />
                {config.school_address}
              </p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">
            {editingRequest ? 'Edit Permintaan Interview' : 'Ajukan Permintaan Interview'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tanggal Interview <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.proposed_date}
                onChange={(e) => setFormData({ ...formData, proposed_date: e.target.value })}
                min={format(addDays(new Date(), config?.interview_min_days_notice || 2), 'yyyy-MM-dd')}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Minimal {config?.interview_min_days_notice || 2} hari ke depan. Tidak dapat memilih hari Minggu.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Waktu Mulai <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={formData.proposed_time_start}
                onChange={(e) => setFormData({ ...formData, proposed_time_start: e.target.value })}
                min={config?.interview_start_hour || '08:00'}
                max={config?.interview_end_hour || '16:00'}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Format Interview <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.proposed_type === 'offline'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <input
                    type="radio"
                    name="type"
                    value="offline"
                    checked={formData.proposed_type === 'offline'}
                    onChange={(e) => setFormData({ ...formData, proposed_type: e.target.value as 'offline' })}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <MapPin className="h-4 w-4" />
                      Offline
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Di lokasi sekolah</p>
                  </div>
                </label>

                <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.proposed_type === 'online'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <input
                    type="radio"
                    name="type"
                    value="online"
                    checked={formData.proposed_type === 'online'}
                    onChange={(e) => setFormData({ ...formData, proposed_type: e.target.value as 'online' })}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <Video className="h-4 w-4" />
                      Online
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Link dari admin</p>
                  </div>
                </label>
              </div>

              {formData.proposed_type === 'online' && (
                <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Link meeting akan dikirimkan oleh admin setelah jadwal disetujui
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Catatan (Opsional)
              </label>
              <textarea
                value={formData.student_notes}
                onChange={(e) => setFormData({ ...formData, student_notes: e.target.value })}
                rows={3}
                placeholder="Informasi tambahan atau keperluan khusus..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingRequest ? 'Perbarui Permintaan' : 'Ajukan Permintaan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingRequest(null);
                  resetForm();
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-slate-800 mb-4">Riwayat Permintaan</h3>

        {requests.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl">
            <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Belum ada permintaan interview</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    {getStatusBadge(request.status)}
                  </div>
                  <span className="text-sm text-slate-500">
                    {format(new Date(request.created_at), 'dd MMM yyyy HH:mm')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">{format(new Date(request.proposed_date), 'EEEE, dd MMMM yyyy')}</span>
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

                  {request.student_notes && (
                    <div className="text-sm">
                      <p className="font-medium text-slate-700 mb-1">Catatan Anda:</p>
                      <p className="text-slate-600">{request.student_notes}</p>
                    </div>
                  )}
                </div>

                {request.status === 'approved' && request.meeting_link && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-emerald-800 mb-2">Link Meeting:</p>
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
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-slate-700 mb-1">Catatan Admin:</p>
                    <p className="text-sm text-slate-600">{request.admin_notes}</p>
                  </div>
                )}

                {request.status === 'revision_requested' && request.revision_requested_notes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-blue-800 mb-1">Perlu Revisi:</p>
                    <p className="text-sm text-blue-700">{request.revision_requested_notes}</p>
                  </div>
                )}

                {request.status === 'rejected' && request.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-red-800 mb-1">Alasan Penolakan:</p>
                    <p className="text-sm text-red-700">{request.rejection_reason}</p>
                  </div>
                )}

                {request.status === 'revision_requested' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEdit(request)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Edit & Ajukan Ulang
                    </button>
                  </div>
                )}

                {request.status === 'pending_review' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCancelRequest(request.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                      Batalkan
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
