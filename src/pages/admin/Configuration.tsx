import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, School, Mail, Palette, Image, Users } from 'lucide-react';

type TabType = 'system' | 'identity' | 'slideshow' | 'status' | 'email' | 'interviewers';

export const Configuration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('system');

  const tabs = [
    { id: 'system' as TabType, label: 'Pengaturan Sistem', icon: Settings },
    { id: 'identity' as TabType, label: 'Identitas Sekolah', icon: School },
    { id: 'slideshow' as TabType, label: 'Slideshow', icon: Image },
    { id: 'interviewers' as TabType, label: 'Interviewers', icon: Users },
    { id: 'status' as TabType, label: 'Status Management', icon: Palette },
    { id: 'email' as TabType, label: 'Email Templates', icon: Mail }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Konfigurasi</h2>
        <p className="text-slate-600 mt-1">Kelola pengaturan sistem dan customization</p>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {activeTab === 'system' && <SystemSettings />}
        {activeTab === 'identity' && <SchoolIdentity />}
        {activeTab === 'slideshow' && <SlideshowManager />}
        {activeTab === 'interviewers' && <InterviewersManager />}
        {activeTab === 'status' && <StatusManagement />}
        {activeTab === 'email' && <EmailTemplates />}
      </div>
    </div>
  );
};

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    school_name: '',
    school_logo: '',
    login_announcement: '',
    registration_open: true,
    registration_start: '',
    registration_end: '',
    max_quota: 100
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const keys = Object.keys(settings);
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .in('key', keys);

      if (error) throw error;

      const settingsMap: Record<string, any> = {};
      (data || []).forEach((item) => {
        settingsMap[item.key] = item.value;
      });

      setSettings((prev) => ({ ...prev, ...settingsMap }));
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('app_config')
          .upsert(
            { key: update.key, value: update.value, updated_at: update.updated_at },
            { onConflict: 'key' }
          );

        if (error) {
          console.error(`Error upserting ${update.key}:`, error);
          throw error;
        }
      }

      alert('Pengaturan berhasil disimpan! Perubahan akan terlihat di homepage.');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Gagal menyimpan pengaturan: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-600">Memuat pengaturan...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Informasi Sekolah</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nama Sekolah
            </label>
            <input
              type="text"
              value={settings.school_name}
              onChange={(e) => setSettings({ ...settings, school_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="SMA Negeri 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              URL Logo Sekolah
            </label>
            <input
              type="text"
              value={settings.school_logo}
              onChange={(e) => setSettings({ ...settings, school_logo: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="https://example.com/logo.png"
            />
            {settings.school_logo && (
              <div className="mt-2">
                <img src={settings.school_logo} alt="Logo Preview" className="h-20 w-20 object-contain border border-slate-200 rounded-lg p-2" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Pengumuman Login
            </label>
            <textarea
              value={settings.login_announcement}
              onChange={(e) => setSettings({ ...settings, login_announcement: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Pengumuman yang akan ditampilkan di halaman login..."
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Pengaturan Pendaftaran</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="registration_open"
              checked={settings.registration_open}
              onChange={(e) => setSettings({ ...settings, registration_open: e.target.checked })}
              className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="registration_open" className="text-sm font-medium text-slate-700">
              Buka Pendaftaran
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={settings.registration_start}
                onChange={(e) => setSettings({ ...settings, registration_start: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tanggal Berakhir
              </label>
              <input
                type="date"
                value={settings.registration_end}
                onChange={(e) => setSettings({ ...settings, registration_end: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Kuota Maksimal
            </label>
            <input
              type="number"
              value={settings.max_quota}
              onChange={(e) => setSettings({ ...settings, max_quota: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="100"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  );
};

const StatusManagement: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Status Aplikasi</h3>
          <p className="text-sm text-slate-600 mb-4">
            Kelola status yang tersedia untuk aplikasi pendaftaran siswa.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { key: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700', description: 'Aplikasi masih dalam draft' },
            { key: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-700', description: 'Aplikasi telah disubmit' },
            { key: 'review', label: 'Review', color: 'bg-amber-100 text-amber-700', description: 'Sedang dalam proses review' },
            { key: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700', description: 'Aplikasi diterima' },
            { key: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700', description: 'Aplikasi ditolak' }
          ].map((status) => (
            <div key={status.key} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1.5 rounded-full font-medium ${status.color}`}>
                  {status.label}
                </span>
                <div>
                  <div className="text-sm font-medium text-slate-800">{status.description}</div>
                  <div className="text-xs text-slate-500">Key: {status.key}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            <strong>Note:</strong> Customizable status management akan tersedia di versi mendatang. Status default sudah mencakup workflow PPDB yang umum digunakan.
          </p>
        </div>
      </div>
    </div>
  );
};

const EmailTemplates: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="text-center py-12">
        <Mail className="h-16 w-16 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Email Templates</h3>
        <p className="text-slate-600 mb-4">
          Fitur email templates akan segera tersedia untuk mengirim notifikasi otomatis ke siswa.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto text-left">
          <p className="text-sm text-blue-900 mb-2">
            <strong>Planned Features:</strong>
          </p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Email untuk registrasi berhasil</li>
            <li>Email notifikasi perubahan status</li>
            <li>Email reminder untuk melengkapi data</li>
            <li>Email acceptance/rejection letter</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const SchoolIdentity: React.FC = () => {
  const [identity, setIdentity] = useState({
    school_name: '',
    academic_year: '',
    school_logo: '',
    school_motto: '',
    school_description: '',
    school_address: '',
    school_phone: '',
    school_email: '',
    school_website: '',
    social_facebook: '',
    social_instagram: '',
    social_twitter: '',
    stat_students: '',
    stat_teachers: '',
    stat_graduation: '',
    show_statistics: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIdentity();
  }, []);

  const fetchIdentity = async () => {
    try {
      setLoading(true);
      const keys = Object.keys(identity);
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .in('key', keys);

      if (error) throw error;

      const identityMap: Record<string, any> = {};
      (data || []).forEach((item) => {
        identityMap[item.key] = item.value;
      });

      setIdentity((prev) => ({ ...prev, ...identityMap }));
    } catch (error) {
      console.error('Error fetching identity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updates = Object.entries(identity).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('app_config')
          .upsert(
            { key: update.key, value: update.value, updated_at: update.updated_at },
            { onConflict: 'key' }
          );

        if (error) {
          console.error(`Error upserting ${update.key}:`, error);
          throw error;
        }
      }

      alert('Identitas sekolah berhasil disimpan! Perubahan akan terlihat di homepage.');
    } catch (error) {
      console.error('Error saving identity:', error);
      alert('Gagal menyimpan identitas sekolah: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    window.open('/', '_blank');
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-600">Loading...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">Identitas Sekolah</h3>

      <div className="space-y-6 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nama Sekolah *
            </label>
            <input
              type="text"
              value={identity.school_name}
              onChange={(e) => setIdentity({ ...identity, school_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="SMA Negeri 1 Jakarta"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tahun Pelajaran *
            </label>
            <input
              type="text"
              value={identity.academic_year}
              onChange={(e) => setIdentity({ ...identity, academic_year: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="2024/2025"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Logo Sekolah (URL)
          </label>
          <input
            type="url"
            value={identity.school_logo}
            onChange={(e) => setIdentity({ ...identity, school_logo: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="https://example.com/logo.png"
          />
          {identity.school_logo && (
            <div className="mt-3">
              <img
                src={identity.school_logo}
                alt="Preview"
                className="h-20 object-contain border border-slate-200 rounded-lg p-2"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Motto/Tagline
          </label>
          <input
            type="text"
            value={identity.school_motto}
            onChange={(e) => setIdentity({ ...identity, school_motto: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Unggul dalam Prestasi, Santun dalam Budi Pekerti"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Deskripsi Singkat
          </label>
          <textarea
            value={identity.school_description}
            onChange={(e) => setIdentity({ ...identity, school_description: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            rows={3}
            placeholder="Sekolah unggulan dengan fasilitas terbaik..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Alamat Lengkap
          </label>
          <textarea
            value={identity.school_address}
            onChange={(e) => setIdentity({ ...identity, school_address: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            rows={2}
            placeholder="Jl. Pendidikan No. 123, Jakarta"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Telepon
            </label>
            <input
              type="tel"
              value={identity.school_phone}
              onChange={(e) => setIdentity({ ...identity, school_phone: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="021-12345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={identity.school_email}
              onChange={(e) => setIdentity({ ...identity, school_email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="info@sekolah.sch.id"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Website
            </label>
            <input
              type="url"
              value={identity.school_website}
              onChange={(e) => setIdentity({ ...identity, school_website: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="https://sekolah.sch.id"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200">
          <h4 className="text-md font-semibold text-slate-800 mb-4">Media Sosial</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Facebook
              </label>
              <input
                type="url"
                value={identity.social_facebook}
                onChange={(e) => setIdentity({ ...identity, social_facebook: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="https://facebook.com/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Instagram
              </label>
              <input
                type="url"
                value={identity.social_instagram}
                onChange={(e) => setIdentity({ ...identity, social_instagram: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="https://instagram.com/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Twitter/X
              </label>
              <input
                type="url"
                value={identity.social_twitter}
                onChange={(e) => setIdentity({ ...identity, social_twitter: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="https://twitter.com/..."
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200">
          <h4 className="text-md font-semibold text-slate-800 mb-4">Statistik (untuk Landing Page)</h4>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="show_statistics"
              checked={identity.show_statistics}
              onChange={(e) => setIdentity({ ...identity, show_statistics: e.target.checked })}
              className="h-4 w-4 text-blue-600 border-slate-300 rounded"
            />
            <label htmlFor="show_statistics" className="text-sm font-medium text-slate-700">
              Tampilkan statistik di landing page
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jumlah Siswa
              </label>
              <input
                type="text"
                value={identity.stat_students}
                onChange={(e) => setIdentity({ ...identity, stat_students: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="1000+"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Jumlah Guru
              </label>
              <input
                type="text"
                value={identity.stat_teachers}
                onChange={(e) => setIdentity({ ...identity, stat_teachers: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="50+"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tingkat Kelulusan
              </label>
              <input
                type="text"
                value={identity.stat_graduation}
                onChange={(e) => setIdentity({ ...identity, stat_graduation: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="95%"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePreview}
            className="flex-1 bg-slate-600 text-white px-6 py-3 rounded-lg hover:bg-slate-700 transition-colors font-medium"
          >
            Preview Homepage
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SlideshowManager: React.FC = () => {
  const [slides, setSlides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSlide, setEditSlide] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('slideshow_images')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setSlides(data || []);
    } catch (error) {
      console.error('Error fetching slides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus gambar ini?')) return;

    try {
      const { error } = await supabase
        .from('slideshow_images')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchSlides();
    } catch (error) {
      console.error('Error deleting slide:', error);
      alert('Gagal menghapus gambar');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('slideshow_images')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      await fetchSlides();
    } catch (error) {
      console.error('Error toggling active:', error);
      alert('Gagal mengubah status');
    }
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = slides.findIndex(s => s.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    try {
      const currentSlide = slides[currentIndex];
      const targetSlide = slides[targetIndex];

      await supabase
        .from('slideshow_images')
        .update({ order_index: targetSlide.order_index })
        .eq('id', currentSlide.id);

      await supabase
        .from('slideshow_images')
        .update({ order_index: currentSlide.order_index })
        .eq('id', targetSlide.id);

      await fetchSlides();
    } catch (error) {
      console.error('Error reordering:', error);
      alert('Gagal mengubah urutan');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-600">Loading...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Manajemen Slideshow</h3>
          <p className="text-sm text-slate-600 mt-1">Kelola gambar slideshow untuk landing page</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tambah Gambar
        </button>
      </div>

      <div className="space-y-4">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg"
          >
            <img
              src={slide.image_url}
              alt={slide.title || 'Slide'}
              className="w-32 h-20 object-cover rounded"
            />

            <div className="flex-1">
              <div className="font-medium text-slate-800">{slide.title || 'Tanpa judul'}</div>
              <div className="text-sm text-slate-600">{slide.description || 'Tanpa deskripsi'}</div>
              <div className="text-xs text-slate-500 mt-1">Urutan: {slide.order_index}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReorder(slide.id, 'up')}
                disabled={index === 0}
                className="px-2 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => handleReorder(slide.id, 'down')}
                disabled={index === slides.length - 1}
                className="px-2 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => handleToggleActive(slide.id, slide.is_active)}
                className={`px-3 py-1 text-sm rounded ${
                  slide.is_active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {slide.is_active ? 'Aktif' : 'Non-aktif'}
              </button>
              <button
                onClick={() => setEditSlide(slide)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(slide.id)}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Hapus
              </button>
            </div>
          </div>
        ))}

        {slides.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            Belum ada gambar. Klik tombol "Tambah Gambar" untuk mulai.
          </div>
        )}
      </div>

      {(showAddModal || editSlide) && (
        <SlideFormModal
          slide={editSlide}
          onClose={() => {
            setShowAddModal(false);
            setEditSlide(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditSlide(null);
            fetchSlides();
          }}
        />
      )}
    </div>
  );
};

interface SlideFormModalProps {
  slide?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const SlideFormModal: React.FC<SlideFormModalProps> = ({ slide, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: slide?.title || '',
    description: slide?.description || '',
    image_url: slide?.image_url || '',
    order_index: slide?.order_index || 0,
    is_active: slide?.is_active ?? true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.image_url) {
      alert('URL gambar wajib diisi');
      return;
    }

    try {
      setSaving(true);

      if (slide) {
        const { error } = await supabase
          .from('slideshow_images')
          .update(formData)
          .eq('id', slide.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('slideshow_images')
          .insert(formData);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving slide:', error);
      alert('Gagal menyimpan gambar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">
            {slide ? 'Edit Gambar Slideshow' : 'Tambah Gambar Slideshow'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              URL Gambar *
            </label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="https://example.com/image.jpg"
              required
            />
            {formData.image_url && (
              <div className="mt-3">
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg border border-slate-200"
                />
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Ukuran rekomendasi: 1920x1080px. Gunakan gambar dari Pexels atau sumber lain.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Judul (Opsional)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Gedung Sekolah"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Deskripsi (Opsional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              rows={3}
              placeholder="Fasilitas modern dan nyaman..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Urutan
            </label>
            <input
              type="number"
              value={formData.order_index}
              onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              min="0"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-blue-600 border-slate-300 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
              Aktif (tampilkan di slideshow)
            </label>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const InterviewersManager: React.FC = () => {
  const [interviewers, setInterviewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editInterviewer, setEditInterviewer] = useState<any>(null);

  useEffect(() => {
    fetchInterviewers();
  }, []);

  const fetchInterviewers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('interviewers')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setInterviewers(data || []);
    } catch (error) {
      console.error('Error fetching interviewers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus interviewer ini?')) return;

    try {
      const { error } = await supabase
        .from('interviewers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchInterviewers();
    } catch (error) {
      console.error('Error deleting interviewer:', error);
      alert('Gagal menghapus interviewer');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('interviewers')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      await fetchInterviewers();
    } catch (error) {
      console.error('Error toggling active:', error);
      alert('Gagal mengubah status');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-600">Loading...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Manajemen Interviewer</h3>
          <p className="text-sm text-slate-600 mt-1">Kelola data interviewer untuk proses wawancara</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tambah Interviewer
        </button>
      </div>

      <div className="space-y-3">
        {interviewers.map((interviewer) => (
          <div
            key={interviewer.id}
            className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium text-slate-800">{interviewer.full_name}</div>
              <div className="text-sm text-slate-600">{interviewer.email}</div>
              {interviewer.phone && (
                <div className="text-xs text-slate-600 mt-0.5">WhatsApp: {interviewer.phone}</div>
              )}
              {interviewer.specialization && (
                <div className="text-xs text-slate-500 mt-1">Spesialisasi: {interviewer.specialization}</div>
              )}
              <div className="flex gap-2 mt-2">
                {interviewer.email_notifications && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                    <Mail className="h-3 w-3" />
                    Email
                  </span>
                )}
                {interviewer.whatsapp_notifications && interviewer.phone && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    WhatsApp
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(interviewer.id, interviewer.is_active)}
                className={`px-3 py-1 text-sm rounded ${
                  interviewer.is_active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {interviewer.is_active ? 'Aktif' : 'Non-aktif'}
              </button>
              <button
                onClick={() => setEditInterviewer(interviewer)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(interviewer.id)}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Hapus
              </button>
            </div>
          </div>
        ))}

        {interviewers.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            Belum ada interviewer. Klik tombol "Tambah Interviewer" untuk mulai.
          </div>
        )}
      </div>

      {(showAddModal || editInterviewer) && (
        <InterviewerFormModal
          interviewer={editInterviewer}
          onClose={() => {
            setShowAddModal(false);
            setEditInterviewer(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditInterviewer(null);
            fetchInterviewers();
          }}
        />
      )}
    </div>
  );
};

interface InterviewerFormModalProps {
  interviewer?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const InterviewerFormModal: React.FC<InterviewerFormModalProps> = ({ interviewer, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: interviewer?.full_name || '',
    email: interviewer?.email || '',
    phone: interviewer?.phone || '',
    specialization: interviewer?.specialization || '',
    is_active: interviewer?.is_active ?? true,
    email_notifications: interviewer?.email_notifications ?? true,
    whatsapp_notifications: interviewer?.whatsapp_notifications ?? true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name || !formData.email) {
      alert('Nama dan email wajib diisi');
      return;
    }

    try {
      setSaving(true);

      if (interviewer) {
        const { error } = await supabase
          .from('interviewers')
          .update(formData)
          .eq('id', interviewer.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('interviewers')
          .insert(formData);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving interviewer:', error);
      alert('Gagal menyimpan interviewer: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">
            {interviewer ? 'Edit Interviewer' : 'Tambah Interviewer'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nama Lengkap *
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Dr. John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="john.doe@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nomor WhatsApp (Opsional)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="628123456789"
            />
            <p className="text-xs text-slate-500 mt-1">
              Format: 628xxx (dengan kode negara, tanpa +)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Spesialisasi (Opsional)
            </label>
            <input
              type="text"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Matematika, Sains, dll"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="interviewer_is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-slate-300 rounded"
              />
              <label htmlFor="interviewer_is_active" className="text-sm font-medium text-slate-700">
                Aktif (dapat ditugaskan untuk interview)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="interviewer_email_notifications"
                checked={formData.email_notifications}
                onChange={(e) => setFormData({ ...formData, email_notifications: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-slate-300 rounded"
              />
              <label htmlFor="interviewer_email_notifications" className="text-sm font-medium text-slate-700">
                Aktifkan Notifikasi Email
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="interviewer_whatsapp_notifications"
                checked={formData.whatsapp_notifications}
                onChange={(e) => setFormData({ ...formData, whatsapp_notifications: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                disabled={!formData.phone}
              />
              <label htmlFor="interviewer_whatsapp_notifications" className="text-sm font-medium text-slate-700">
                Aktifkan Notifikasi WhatsApp
                {!formData.phone && <span className="text-xs text-slate-500 ml-1">(masukkan nomor WhatsApp terlebih dahulu)</span>}
              </label>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
