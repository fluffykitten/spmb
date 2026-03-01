import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { School, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const { signIn, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConfig = async () => {
      const { data: announcementData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'login_announcement')
        .maybeSingle();

      const { data: logoData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'school_logo')
        .maybeSingle();

      if (announcementData?.value) {
        setAnnouncement(announcementData.value as string);
      }

      if (logoData?.value) {
        setLogoUrl(logoData.value as string);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const timeout = setTimeout(() => {
      setLoading(false);
      setError('Login timeout. Silakan coba lagi.');
    }, 10000);

    try {
      const { error } = await signIn(email, password);

      clearTimeout(timeout);

      if (error) {
        setError('Email atau password salah. Silakan coba lagi.');
      }
    } catch (err) {
      clearTimeout(timeout);
      setError('Terjadi kesalahan. Silakan coba lagi.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col justify-center">
          <div className="mb-8 text-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-20 w-20 mx-auto mb-4 object-contain" />
            ) : (
              <div className="h-20 w-20 mx-auto mb-4 bg-blue-600 rounded-xl flex items-center justify-center">
                <School className="h-12 w-12 text-white" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-slate-800">Sistem SPMB</h1>
            <p className="text-slate-600 mt-2">Sistem Penerimaan Murid Baru</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

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
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Belum punya akun?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Daftar di sini
              </Link>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col justify-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Pengumuman</h2>
            {announcement ? (
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{announcement}</p>
              </div>
            ) : (
              <div className="text-slate-500 italic">
                <p>Selamat datang di Sistem Penerimaan Murid Baru (SPMB).</p>
                <p className="mt-4">Silakan login menggunakan akun yang telah didaftarkan.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
