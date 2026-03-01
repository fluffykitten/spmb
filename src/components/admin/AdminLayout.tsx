import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  School,
  UserCog,
  BarChart3,
  FolderOpen,
  FileCode,
  Calendar,
  ClipboardList,
  FileArchive,
  MessageSquare,
  Ticket,
  Waves,
  Database,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Users, label: 'Siswa', path: '/admin/students' },
    { icon: Waves, label: 'Gelombang Pendaftaran', path: '/admin/batches' },
    { icon: Calendar, label: 'Interview', path: '/admin/interviews' },
    { icon: ClipboardList, label: 'Exam Builder', path: '/admin/exams' },
    { icon: Ticket, label: 'Exam Tokens', path: '/admin/exam-tokens' },
    { icon: FolderOpen, label: 'Dokumen', path: '/admin/documents' },
    { icon: FileText, label: 'Template Surat', path: '/admin/templates' },
    { icon: FileArchive, label: 'Template DOCX', path: '/admin/docx-templates' },
    { icon: FileCode, label: 'Form Builder', path: '/admin/form-builder' },
    { icon: MessageSquare, label: 'WhatsApp', path: '/admin/whatsapp' },
    { icon: UserCog, label: 'User Management', path: '/admin/users' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
    { icon: Settings, label: 'Konfigurasi', path: '/admin/settings' },
    { icon: Database, label: 'Database Backup', path: '/admin/backup' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className={`fixed inset-0 bg-slate-900 bg-opacity-50 z-40 lg:hidden transition-opacity ${
        sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`} onClick={() => setSidebarOpen(false)} />

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 transform transition-transform lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
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
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
