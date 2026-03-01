import { useState } from 'react';
import { Database, Plus, History, RefreshCw } from 'lucide-react';
import BackupCreator from '../../components/admin/BackupCreator';
import BackupHistory from '../../components/admin/BackupHistory';
import RestoreWizard from '../../components/admin/RestoreWizard';

type TabType = 'create' | 'history' | 'restore';

export default function DatabaseBackup() {
  const [activeTab, setActiveTab] = useState<TabType>('create');

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'create', label: 'Create Backup', icon: Plus },
    { id: 'history', label: 'Backup History', icon: History },
    { id: 'restore', label: 'Restore Backup', icon: RefreshCw },
  ];

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Database Backup & Restore</h1>
              <p className="text-sm text-gray-600 mt-1">
                Create, manage, and restore database backups
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                      ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'create' && <BackupCreator />}
            {activeTab === 'history' && <BackupHistory />}
            {activeTab === 'restore' && <RestoreWizard />}
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Best Practices</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold mt-0.5">•</span>
              <span>Create regular backups before making major changes to your database</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold mt-0.5">•</span>
              <span>Download important backups to your local machine for extra safety</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold mt-0.5">•</span>
              <span>Always create a safety backup before restoring from another backup</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold mt-0.5">•</span>
              <span>Test restore procedures on non-production environments when possible</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold mt-0.5">•</span>
              <span>Keep backups organized with clear names and descriptions</span>
            </li>
          </ul>
        </div>
    </div>
  );
}
