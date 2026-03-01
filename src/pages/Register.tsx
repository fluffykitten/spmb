import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { School, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { validatePhoneNumber, formatPhoneNumber, sendWhatsAppNotification } from '../lib/whatsappNotification';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const { signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConfig = async () => {
      const { data: logoData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'school_logo')
        .maybeSingle();

      if (logoData?.value) {
        setLogoUrl(logoData.value as string);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/student/dashboard');
    }
  }, [user, navigate]);

  const validateForm = (): boolean => {
    if (!fullName.trim()) {
      setError('Nama lengkap wajib diisi');
      return false;
    }

    if (!email.trim()) {
      setError('Email wajib diisi');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Format email tidak valid');
      return false;
    }

    if (!phoneNumber.trim()) {
      setError('Nomor HP wajib diisi');
      return false;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Format nomor HP tidak valid. Gunakan format 08xxx atau 628xxx');
      return false;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak sama');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const timeout = setTimeout(() => {
      setLoading(false);
      setError('Registrasi timeout. Silakan coba lagi.');
    }, 15000);

    try {
      console.log('[Register] Attempting registration for:', email);
      const { error } = await signUp(email, password, fullName);

      clearTimeout(timeout);

      if (error) {
        console.error('[Register] Registration error:', error);
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          setError('Email sudah terdaftar. Silakan gunakan email lain atau login.');
        } else if (error.message.includes('email')) {
          setError('Silakan cek email Anda untuk konfirmasi pendaftaran.');
        } else if (error.message.includes('rate limit')) {
          setError('Terlalu banyak percobaan. Tunggu beberapa menit.');
        } else if (error.message.includes('Password')) {
          setError('Password terlalu lemah. Gunakan minimal 6 karakter.');
        } else {
          setError(error.message || 'Terjadi kesalahan saat mendaftar. Silakan coba lagi.');
        }
      } else {
        console.log('[Register] Registration successful');

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const formattedPhone = formatPhoneNumber(phoneNumber);

          await supabase
            .from('profiles')
            .update({ phone_number: formattedPhone })
            .eq('user_id', session.user.id);

          sendWhatsAppNotification({
            phone: formattedPhone,
            templateKey: 'registration_success',
            variables: {
              nama_lengkap: fullName,
              email: email
            }
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

        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error('[Register] Registration exception:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
      } else {
        setError('Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="h-16 w-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Registrasi Berhasil!</h2>
              <p className="text-slate-600 mb-6">
                Akun Anda telah berhasil dibuat. Anda akan diarahkan ke halaman login...
              </p>
              <Link
                to="/login"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ke Halaman Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Login
            </Link>

            <div className="text-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-20 w-20 mx-auto mb-4 object-contain" />
              ) : (
                <div className="h-20 w-20 mx-auto mb-4 bg-blue-600 rounded-xl flex items-center justify-center">
                  <School className="h-12 w-12 text-white" />
                </div>
              )}
              <h1 className="text-3xl font-bold text-slate-800">Daftar Akun Siswa</h1>
              <p className="text-slate-600 mt-2">Buat akun baru untuk mendaftar SPMB</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-2">
                Nama Lengkap
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Nama lengkap Anda"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="nama@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-700 mb-2">
                Nomor HP / WhatsApp
              </label>
              <input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="08123456789 atau 628123456789"
                disabled={loading}
              />
              <p className="text-xs text-slate-500 mt-1">
                Nomor ini akan digunakan untuk notifikasi WhatsApp
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Minimal 6 karakter"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                Konfirmasi Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Ulangi password Anda"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Daftar Sekarang'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Sudah punya akun?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Login di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
