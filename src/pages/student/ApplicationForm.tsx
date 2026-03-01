import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { DynamicFormRenderer } from '../../components/DynamicFormRenderer';
import { FormField, defaultFormSchema } from '../../lib/defaultFormSchema';
import { Save, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { sendWhatsAppNotification, sendWhatsAppGroupNotification } from '../../lib/whatsappNotification';
import { FIELD_NAMES, getFieldValue } from '../../lib/fieldConstants';

export const ApplicationForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schema, setSchema] = useState<FormField[]>(defaultFormSchema);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'draft' | 'submitted'>('draft');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: configData } = await supabase
          .from('form_schemas')
          .select('*')
          .eq('name', 'application_form')
          .eq('is_active', true)
          .maybeSingle();

        if (configData?.fields) {
          setSchema(configData.fields as FormField[]);
        }

        const { data: applicantData } = await supabase
          .from('applicants')
          .select('*')
          .eq('user_id', user?.id)
          .maybeSingle();

        if (applicantData) {
          setFormData(applicantData.dynamic_data || {});
          setStatus(applicantData.status);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && (!value || value === '')) {
      return `${field.label} wajib diisi`;
    }

    if (!value) return null;

    if (field.validation) {
      const val = field.validation;

      if (val.minLength && value.length < val.minLength) {
        return `${field.label} minimal ${val.minLength} karakter`;
      }

      if (val.maxLength && value.length > val.maxLength) {
        return `${field.label} maksimal ${val.maxLength} karakter`;
      }

      if (val.min && Number(value) < val.min) {
        return `${field.label} minimal ${val.min}`;
      }

      if (val.max && Number(value) > val.max) {
        return `${field.label} maksimal ${val.max}`;
      }

      if (val.pattern) {
        const regex = new RegExp(val.pattern);
        if (!regex.test(value)) {
          return `Format ${field.label} tidak valid`;
        }
      }
    }

    if (field.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Format email tidak valid';
      }
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    schema.forEach((field) => {
      const error = validateField(field, formData[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    const field = schema.find((f) => f.name === name);
    if (field) {
      const error = validateField(field, value);
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[name] = error;
        } else {
          delete newErrors[name];
        }
        return newErrors;
      });
    }
  };

  const handleSaveDraft = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const { data: existing } = await supabase
        .from('applicants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('applicants')
          .update({
            dynamic_data: formData,
            status: 'draft',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('applicants')
          .insert({
            user_id: user.id,
            dynamic_data: formData,
            status: 'draft',
          });

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Draft berhasil disimpan!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving draft:', error);
      setMessage({ type: 'error', text: 'Gagal menyimpan draft. Silakan coba lagi.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setMessage({ type: 'error', text: 'Mohon lengkapi semua field yang wajib diisi dengan benar.' });
      return;
    }

    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const { data: existing } = await supabase
        .from('applicants')
        .select('id, registration_number')
        .eq('user_id', user.id)
        .maybeSingle();

      let applicantId: string | undefined;
      let registrationNumber = existing?.registration_number;

      if (!registrationNumber) {
        // Fetch new registration number from backend
        try {
          const token = localStorage.getItem('auth_token');
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
          const res = await fetch(`${apiUrl}/api/applicants/generate-registration-number`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const result = await res.json();
            if (result.data?.registration_number) {
              registrationNumber = result.data.registration_number;
            }
          }
        } catch (err) {
          console.error('Failed to generate registration number from API:', err);
        }

        // Fallback format if API fails for some reason
        if (!registrationNumber) {
          const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
          const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
          registrationNumber = `REG-${dateStr}-${randomStr}`;
        }
      }

      if (existing) {
        const { error, data } = await supabase
          .from('applicants')
          .update({
            dynamic_data: formData,
            status: 'submitted',
            registration_number: registrationNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .select('id, registration_number')
          .single();

        if (error) throw error;
        applicantId = data?.id;
        registrationNumber = data?.registration_number || registrationNumber;
      } else {
        const { error, data } = await supabase
          .from('applicants')
          .insert({
            user_id: user.id,
            dynamic_data: formData,
            registration_number: registrationNumber,
            status: 'submitted',
          })
          .select('id, registration_number')
          .single();

        if (error) throw error;
        applicantId = data?.id;
        registrationNumber = data?.registration_number || registrationNumber;
      }

      const phoneNumber = getFieldValue(formData, FIELD_NAMES.NO_TELEPON);
      const namaLengkap = getFieldValue(formData, FIELD_NAMES.NAMA_LENGKAP);

      if (phoneNumber) {
        const today = new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        sendWhatsAppNotification({
          phone: phoneNumber,
          templateKey: 'application_submitted',
          variables: {
            nama_lengkap: namaLengkap || 'Calon Siswa',
            registration_number: registrationNumber || 'Belum tersedia',
            tanggal_submit: today
          },
          applicantId
        }).then(result => {
          if (result.success) {
            console.log('WhatsApp notification sent successfully');
          } else {
            console.error('Failed to send WhatsApp notification:', result.error);
          }
        }).catch(err => {
          console.error('Error sending WhatsApp notification:', err);
        });
      }

      // Send group notification for new registration
      sendWhatsAppGroupNotification({
        templateKey: 'group_new_registration',
        variables: {
          nama_lengkap: namaLengkap || 'Calon Siswa',
          registration_number: registrationNumber || 'Belum tersedia',
          tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        }
      }).catch(err => {
        console.error('Error sending group notification:', err);
      });

      setStatus('submitted');
      setMessage({ type: 'success', text: 'Formulir berhasil disubmit! Notifikasi WhatsApp akan dikirim. Anda akan diarahkan ke halaman dokumen...' });
      setTimeout(() => navigate('/student/generate'), 2000);
    } catch (error) {
      console.error('Error submitting form:', error);
      setMessage({ type: 'error', text: 'Gagal submit formulir. Silakan coba lagi.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Memuat formulir...</p>
        </div>
      </div>
    );
  }

  if (status === 'submitted') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <div className="h-16 w-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-900 mb-2">Formulir Sudah Disubmit</h2>
          <p className="text-emerald-700 mb-6">
            Formulir pendaftaran Anda sudah disubmit dan menunggu verifikasi dari admin.
            Anda tidak dapat mengubah data yang sudah disubmit.
          </p>
          <button
            onClick={() => navigate('/student/dashboard')}
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Formulir Pendaftaran</h2>
        <p className="text-slate-600 mt-1">Lengkapi semua data dengan benar dan teliti</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <DynamicFormRenderer
          schema={schema}
          formData={formData}
          errors={errors}
          onChange={handleChange}
        />

        <div className="mt-8 flex gap-4 justify-end">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex items-center gap-2 bg-slate-600 text-white px-6 py-3 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5" />
            {saving ? 'Menyimpan...' : 'Simpan Draft'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
            {saving ? 'Memproses...' : 'Submit Pendaftaran'}
          </button>
        </div>
      </form>
    </div>
  );
};
