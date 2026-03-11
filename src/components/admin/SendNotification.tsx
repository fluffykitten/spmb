import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader, Send, AlertCircle, CheckCircle, User, Users, Phone } from 'lucide-react';
import { WhatsAppTemplate, sendWhatsAppNotification, validatePhoneNumber } from '../../lib/whatsappNotification';
import { FIELD_NAMES, getFieldValue } from '../../lib/fieldConstants';
import { VariableCheatSheet } from './VariableCheatSheet';

type RecipientType = 'single' | 'multiple' | 'custom';

interface Applicant {
  id: string;
  user_id: string;
  registration_number: string | null;
  dynamic_data: Record<string, any>;
  profiles?: {
    email: string;
    full_name: string;
  } | null;
  phone_number?: string;
  full_name?: string;
  email?: string;
}

export const SendNotification: React.FC = () => {
  const [recipientType, setRecipientType] = useState<RecipientType>('single');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<string>('');
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [customPhone, setCustomPhone] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTemplates();
    fetchApplicants();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      const initialVars: Record<string, string> = {};
      (selectedTemplate.variables || []).forEach(v => {
        initialVars[v] = '';
      });
      setVariables(initialVars);
    }
  }, [selectedTemplate]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchApplicants = async () => {
    try {
      setLoading(true);
      console.log('Fetching applicants...');

      const { data: applicantsData, error: applicantsError } = await supabase
        .from('applicants')
        .select('*')
        .order('created_at', { ascending: false });

      if (applicantsError) {
        console.error('Error fetching applicants:', applicantsError);
        throw applicantsError;
      }

      console.log('Applicants data:', applicantsData);

      if (!applicantsData || applicantsData.length === 0) {
        console.log('No applicants found');
        setApplicants([]);
        return;
      }

      const userIds = applicantsData.map(a => a.user_id);
      console.log('User IDs:', userIds);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      console.log('Profiles data:', profilesData);

      const profilesMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );

      const enrichedApplicants = applicantsData.map(applicant => {
        const profile = profilesMap.get(applicant.user_id);
        const phoneNumber = getFieldValue(applicant.dynamic_data, FIELD_NAMES.NO_TELEPON);
        const formName = getFieldValue(applicant.dynamic_data, FIELD_NAMES.NAMA_LENGKAP);
        const resolvedName = formName || profile?.full_name || 'Unknown';

        console.log(`[SendNotification] Applicant ${applicant.id}: formName="${formName}", profileName="${profile?.full_name}", resolved="${resolvedName}"`);

        return {
          ...applicant,
          profiles: profile || null,
          full_name: resolvedName,
          email: profile?.email || '',
          phone_number: phoneNumber || ''
        };
      }).filter(applicant => applicant.phone_number);

      console.log('Enriched applicants with phone numbers:', enrichedApplicants);
      setApplicants(enrichedApplicants as Applicant[]);
    } catch (error) {
      console.error('Error fetching applicants:', error);
      setApplicants([]);
    } finally {
      setLoading(false);
    }
  };

  const getPreviewMessage = () => {
    if (!selectedTemplate) return '';

    let message = selectedTemplate.message_body;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`);
    });

    return message;
  };

  const getRecipientInfo = (): { phone: string; name: string; applicantId?: string }[] => {
    if (recipientType === 'single' && selectedApplicant) {
      const applicant = applicants.find(a => a.id === selectedApplicant);
      if (applicant && applicant.phone_number) {
        return [{
          phone: applicant.phone_number,
          name: applicant.full_name || '',
          applicantId: applicant.id
        }];
      }
    } else if (recipientType === 'multiple' && selectedApplicants.length > 0) {
      return selectedApplicants
        .map(id => applicants.find(a => a.id === id))
        .filter(a => a && a.phone_number)
        .map(a => ({
          phone: a!.phone_number!,
          name: a!.full_name || '',
          applicantId: a!.id
        }));
    } else if (recipientType === 'custom' && customPhone) {
      return [{ phone: customPhone, name: 'Custom Recipient', applicantId: undefined }];
    }

    return [];
  };

  const handleSend = async () => {
    if (!selectedTemplate) {
      alert('Please select a template');
      return;
    }

    const recipients = getRecipientInfo();
    if (recipients.length === 0) {
      alert('Please select at least one recipient');
      return;
    }

    const missingVars = (selectedTemplate.variables || []).filter(v => !variables[v] || !variables[v].trim());
    if (missingVars.length > 0) {
      alert(`Please fill in all variables: ${missingVars.join(', ')}`);
      return;
    }

    if (recipientType === 'custom' && !validatePhoneNumber(customPhone)) {
      alert('Please enter a valid phone number');
      return;
    }

    const confirmMessage = recipients.length === 1
      ? `Send WhatsApp notification to ${recipients[0].name}?`
      : `Send WhatsApp notification to ${recipients.length} recipients?`;

    if (!confirm(confirmMessage)) return;

    try {
      setSending(true);
      setResult(null);

      const results = [];
      for (const recipient of recipients) {
        const res = await sendWhatsAppNotification({
          phone: recipient.phone,
          templateKey: selectedTemplate.template_key,
          variables: { ...variables, nama_lengkap: recipient.name },
          applicantId: recipient.applicantId
        });

        results.push({
          name: recipient.name,
          phone: recipient.phone,
          ...res
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const successCount = results.filter(r => r.success).length;

      setResult({
        success: successCount > 0,
        message: `Sent ${successCount} of ${results.length} notifications successfully`,
        details: results
      });

      if (successCount === results.length) {
        setSelectedApplicant('');
        setSelectedApplicants([]);
        setCustomPhone('');
        setVariables({});
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
      setResult({
        success: false,
        message: 'Failed to send notifications: ' + (error as Error).message
      });
    } finally {
      setSending(false);
    }
  };

  const filteredApplicants = applicants.filter(a =>
    (a.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.email && a.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (a.registration_number && a.registration_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Select Recipients</h3>

        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value="single"
                checked={recipientType === 'single'}
                onChange={(e) => setRecipientType(e.target.value as RecipientType)}
                className="h-4 w-4 text-emerald-600"
              />
              <User className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Single Student</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value="multiple"
                checked={recipientType === 'multiple'}
                onChange={(e) => setRecipientType(e.target.value as RecipientType)}
                className="h-4 w-4 text-emerald-600"
              />
              <Users className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Multiple Students</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value="custom"
                checked={recipientType === 'custom'}
                onChange={(e) => setRecipientType(e.target.value as RecipientType)}
                className="h-4 w-4 text-emerald-600"
              />
              <Phone className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Custom Phone Number</span>
            </label>
          </div>

          {applicants.length === 0 && recipientType !== 'custom' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                No students with phone numbers found. Students must have a phone number in their application to receive WhatsApp notifications.
              </p>
            </div>
          )}

          {recipientType === 'single' && applicants.length > 0 && (
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none mb-2"
              />
              <select
                value={selectedApplicant}
                onChange={(e) => setSelectedApplicant(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Select a student</option>
                {filteredApplicants.map((applicant) => (
                  <option key={applicant.id} value={applicant.id}>
                    {applicant.full_name} {applicant.registration_number ? `(${applicant.registration_number})` : ''} - {applicant.phone_number || 'No phone'}
                  </option>
                ))}
              </select>
              {filteredApplicants.length === 0 && searchQuery && (
                <p className="text-sm text-slate-500 mt-2">No students found matching "{searchQuery}"</p>
              )}
            </div>
          )}

          {recipientType === 'multiple' && applicants.length > 0 && (
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none mb-2"
              />
              <div className="max-h-60 overflow-y-auto border border-slate-300 rounded-lg p-3 space-y-2">
                {filteredApplicants.length > 0 ? (
                  filteredApplicants.map((applicant) => (
                    <label
                      key={applicant.id}
                      className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedApplicants.includes(applicant.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedApplicants([...selectedApplicants, applicant.id]);
                          } else {
                            setSelectedApplicants(selectedApplicants.filter(id => id !== applicant.id));
                          }
                        }}
                        className="h-4 w-4 text-emerald-600 border-slate-300 rounded"
                      />
                      <span className="text-sm text-slate-700">
                        {applicant.full_name} {applicant.registration_number ? `(${applicant.registration_number})` : ''} - {applicant.phone_number}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No students found matching "{searchQuery}"</p>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-2">
                Selected: {selectedApplicants.length} students
              </p>
            </div>
          )}

          {recipientType === 'custom' && (
            <div>
              <input
                type="text"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="08123456789 or 628123456789"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter phone number (Indonesian format: 08xxx or 628xxx)
              </p>
              {customPhone && !validatePhoneNumber(customPhone) && (
                <p className="text-xs text-red-600 mt-1">Invalid phone number format</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Select Template</h3>

        <select
          value={selectedTemplate?.id || ''}
          onChange={(e) => {
            const template = templates.find(t => t.id === e.target.value);
            setSelectedTemplate(template || null);
          }}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          <option value="">Select a template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.template_name}
            </option>
          ))}
        </select>

        {selectedTemplate && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-600 mb-2">Template: {selectedTemplate.template_key}</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTemplate.message_body}</p>
          </div>
        )}
      </div>

      {selectedTemplate && (selectedTemplate.variables || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Fill Variables</h3>
            <VariableCheatSheet />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(selectedTemplate.variables || []).map((variable) => (
              <div key={variable}>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {variable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} *
                </label>
                <input
                  type="text"
                  value={variables[variable] || ''}
                  onChange={(e) => setVariables({ ...variables, [variable]: e.target.value })}
                  placeholder={`Enter ${variable}`}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTemplate && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Message Preview</h3>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{getPreviewMessage()}</p>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Recipients: {getRecipientInfo().length}
            </p>
            <button
              onClick={handleSend}
              disabled={sending || getRecipientInfo().length === 0}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending && <Loader className="h-4 w-4 animate-spin" />}
              {sending ? 'Sending...' : <><Send className="h-4 w-4" /> Send Notification</>}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`bg-white rounded-xl border ${result.success ? 'border-emerald-200' : 'border-red-200'
          } p-6`}>
          <div className="flex items-start gap-3 mb-4">
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${result.success ? 'text-emerald-900' : 'text-red-900'}`}>
                {result.success ? 'Success' : 'Error'}
              </h3>
              <p className={`text-sm ${result.success ? 'text-emerald-700' : 'text-red-700'}`}>
                {result.message}
              </p>
            </div>
          </div>

          {result.details && (
            <div className="space-y-2">
              {result.details.map((detail: any, index: number) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg text-sm ${detail.success
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'bg-red-50 text-red-900'
                    }`}
                >
                  <span className="font-medium">{detail.name}</span> - {detail.success ? 'Sent' : detail.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
