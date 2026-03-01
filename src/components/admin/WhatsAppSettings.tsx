import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, Loader, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { getWhatsAppStats } from '../../lib/whatsappNotification';

interface ConfigState {
  fonnte_api_token: string;
  fonnte_country_code: string;
  fonnte_enabled: boolean;
}

export const WhatsAppSettings: React.FC = () => {
  const [config, setConfig] = useState<ConfigState>({
    fonnte_api_token: '',
    fonnte_country_code: '62',
    fonnte_enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, successRate: 0 });

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['fonnte_api_token', 'fonnte_country_code', 'fonnte_enabled']);

      if (error) throw error;

      const configMap = new Map(data?.map(c => [c.key, c.value]) || []);

      setConfig({
        fonnte_api_token: (configMap.get('fonnte_api_token') as string) || '',
        fonnte_country_code: (configMap.get('fonnte_country_code') as string) || '62',
        fonnte_enabled: (configMap.get('fonnte_enabled') as boolean) || false
      });

      if (configMap.get('fonnte_api_token')) {
        setConnectionStatus('connected');
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      alert('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const todayStats = await getWhatsAppStats('today');
    setStats(todayStats);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updates = [
        { key: 'fonnte_api_token', value: config.fonnte_api_token },
        { key: 'fonnte_country_code', value: config.fonnte_country_code },
        { key: 'fonnte_enabled', value: config.fonnte_enabled }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_config')
          .upsert(
            { key: update.key, value: update.value, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );

        if (error) throw error;
      }

      alert('WhatsApp settings saved successfully!');
      await fetchConfig();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save settings: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.fonnte_api_token) {
      alert('Please enter a Fonnte API token first');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      const response = await fetch('https://api.fonnte.com/validate', {
        method: 'POST',
        headers: {
          'Authorization': config.fonnte_api_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target: '08123456789' })
      });

      const result = await response.json().catch(() => ({ status: false, reason: 'Invalid JSON response' }));

      if (response.ok && result.status !== false) {
        setTestResult({ success: true, message: 'Connection successful! Your API token is valid.' });
        setConnectionStatus('connected');
      } else {
        setTestResult({ success: false, message: result.reason || 'Invalid API token or connection failed' });
        setConnectionStatus('error');
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to connect to Fonnte API' });
      setConnectionStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhone) {
      alert('Please enter a phone number');
      return;
    }

    if (!config.fonnte_enabled) {
      alert('Please enable WhatsApp notifications first');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/whatsapp/send`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: testPhone,
          templateKey: 'custom_message',
          variables: {
            nama_lengkap: 'Admin',
            message_content: 'This is a test message from WhatsApp Management System.'
          }
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Server returned an invalid response');
      }

      if (response.ok && result.success) {
        setTestResult({ success: true, message: 'Test message sent successfully!' });
      } else {
        setTestResult({ success: false, message: result.error || 'Failed to send test message' });
      }
    } catch (error) {
      setTestResult({ success: false, message: (error as Error).message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader className="h-8 w-8 text-slate-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">API Status</p>
            {connectionStatus === 'connected' && (
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            )}
            {connectionStatus === 'error' && (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            {connectionStatus === 'unknown' && (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            )}
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'error' ? 'Error' : 'Not Configured'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-2">Messages Today</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.sent} sent, {stats.failed} failed
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600 mb-2">Success Rate</p>
          <p className="text-2xl font-bold text-slate-800">
            {stats.successRate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Today's performance</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Fonnte API Configuration</h3>

        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fonnte API Token *
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={config.fonnte_api_token}
                  onChange={(e) => setConfig({ ...config, fonnte_api_token: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-10"
                  placeholder="Enter your Fonnte API token"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Get your API token from <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">fonnte.com</a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Country Code *
            </label>
            <select
              value={config.fonnte_country_code}
              onChange={(e) => setConfig({ ...config, fonnte_country_code: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="62">Indonesia (+62)</option>
              <option value="60">Malaysia (+60)</option>
              <option value="65">Singapore (+65)</option>
              <option value="66">Thailand (+66)</option>
              <option value="84">Vietnam (+84)</option>
              <option value="63">Philippines (+63)</option>
              <option value="1">USA/Canada (+1)</option>
              <option value="44">UK (+44)</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Default country code for phone numbers
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="fonnte_enabled"
              checked={config.fonnte_enabled}
              onChange={(e) => setConfig({ ...config, fonnte_enabled: e.target.checked })}
              className="h-5 w-5 text-emerald-600 border-slate-300 rounded focus:ring-2 focus:ring-emerald-500"
            />
            <label htmlFor="fonnte_enabled" className="text-sm font-medium text-slate-700">
              Enable WhatsApp Notifications
            </label>
          </div>

          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Test Connection</h3>

        <div className="space-y-4 max-w-2xl">
          <div>
            <button
              onClick={handleTestConnection}
              disabled={testing || !config.fonnte_api_token}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {testing && <Loader className="h-4 w-4 animate-spin" />}
              {testing ? 'Testing...' : 'Test API Connection'}
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Send Test Message</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="08123456789"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                onClick={handleSendTestMessage}
                disabled={testing || !config.fonnte_enabled}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {testing && <Loader className="h-4 w-4 animate-spin" />}
                Send Test
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enter a phone number to send a test WhatsApp message
            </p>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg border ${testResult.success
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
              }`}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${testResult.success ? 'text-emerald-900' : 'text-red-900'
                    }`}>
                    {testResult.success ? 'Success' : 'Failed'}
                  </p>
                  <p className={`text-sm ${testResult.success ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
