import React, { useState } from 'react';
import { MessageSquare, Settings, FileText, Send, BarChart3, History } from 'lucide-react';
import { WhatsAppSettings } from '../../components/admin/WhatsAppSettings';
import { TemplateManagement } from '../../components/admin/TemplateManagement';
import { SendNotification } from '../../components/admin/SendNotification';
import { WhatsAppAnalytics } from '../../components/admin/WhatsAppAnalytics';
import { NotificationHistory } from '../../components/admin/NotificationHistory';

type TabType = 'settings' | 'templates' | 'send' | 'analytics' | 'history';

export const WhatsAppManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('settings');

  const tabs = [
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
    { id: 'templates' as TabType, label: 'Templates', icon: FileText },
    { id: 'send' as TabType, label: 'Send Notification', icon: Send },
    { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
    { id: 'history' as TabType, label: 'History', icon: History }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">WhatsApp Management</h2>
          <p className="text-slate-600 mt-1">Manage WhatsApp notifications via Fonnte API</p>
        </div>
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
                    ? 'border-emerald-600 text-emerald-600'
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
        {activeTab === 'settings' && <WhatsAppSettings />}
        {activeTab === 'templates' && <TemplateManagement />}
        {activeTab === 'send' && <SendNotification />}
        {activeTab === 'analytics' && <WhatsAppAnalytics />}
        {activeTab === 'history' && <NotificationHistory />}
      </div>
    </div>
  );
};




