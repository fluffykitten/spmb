import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAcademicYear } from '../../contexts/AcademicYearContext';
import {
  LayoutDashboard,
  LogOut,
  School,
  Database,
  Calendar,
  ClipboardList,
  FileArchive,
  MessageSquare,
  Ticket,
  UserCog,
  BarChart3,
  Users,
  FolderOpen,
  FileCode,
  Waves,
  FileText,
  Settings,
  Menu,
  Activity,
  GraduationCap
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut, user } = useAuth();
  const { allYears, selectedYearId, setSelectedYearId } = useAcademicYear();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const menuItems = [
    { label: 'UTAMA', type: 'header' },
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Users, label: 'Siswa', path: '/admin/students' },
    { icon: Activity, label: 'Student Monitoring', path: '/admin/student-monitoring' },

    { label: 'SELEKSI & UJIAN', type: 'header' },
    { icon: Calendar, label: 'Pengajuan Interview', path: '/admin/interviews' },
    { icon: Users, label: 'Daftar Wawancara', path: '/admin/interview-list' },
    { icon: ClipboardList, label: 'Kriteria Wawancara', path: '/admin/interview-criteria' },
    { icon: ClipboardList, label: 'Exam Builder', path: '/admin/exams' },
    { icon: Ticket, label: 'Exam Tokens', path: '/admin/exam-tokens' },

    { label: 'DOKUMEN & KOMUNIKASI', type: 'header' },
    { icon: FolderOpen, label: 'Akses Dokumen', path: '/admin/documents' },
    { icon: FileText, label: 'Template Surat', path: '/admin/templates' },
    { icon: FileArchive, label: 'Template DOCX', path: '/admin/docx-templates' },
    { icon: FileCode, label: 'Form Builder', path: '/admin/form-builder' },
    { icon: MessageSquare, label: 'WhatsApp', path: '/admin/whatsapp' },

    { label: 'PENGATURAN', type: 'header' },
    { icon: UserCog, label: 'User Management', path: '/admin/users' },
    { icon: GraduationCap, label: 'Tahun Pelajaran', path: '/admin/academic-years' },
    { icon: Waves, label: 'Gelombang Pendaftaran', path: '/admin/batches' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
    { icon: Settings, label: 'Konfigurasi', path: '/admin/settings' },
    { icon: Database, label: 'Database Backup', path: '/admin/backup' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className={`fixed inset-0 bg-slate-900 bg-opacity-50 z-40 lg:hidden transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} onClick={() => setSidebarOpen(false)} />

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <School className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">SPMB Admin</h2>
                <p className="text-xs text-slate-500">Panel Administrator</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {menuItems.map((item, idx) => {
              if (item.type === 'header') {
                return (
                  <div key={`header-${idx}`} className="px-3 pt-4 pb-2 text-xs font-bold text-slate-400">
                    {item.label}
                  </div>
                );
              }

              const Icon = item.icon!;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path!}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200">
            <div className="bg-slate-50 rounded-lg p-4 mb-3">
              <p className="text-xs text-slate-500 mb-1">Logged in as</p>
              <p className="text-sm font-medium text-slate-800 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex-1 lg:flex-none">
              <h1 className="text-xl font-bold text-slate-800">Administrator</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                <select
                  value={selectedYearId || ''}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-700 border-none focus:ring-0 cursor-pointer pr-6"
                >
                  {allYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}{year.is_active ? ' (Aktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
