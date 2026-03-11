import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Edit, Trash2, Copy, Loader, AlertCircle } from 'lucide-react';
import { WhatsAppTemplate } from '../../lib/whatsappNotification';
import { VariableCheatSheet } from './VariableCheatSheet';

export const TemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [usageStats, setUsageStats] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchTemplates();
    fetchUsageStats();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchQuery, filterStatus]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('template_name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      alert('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageStats = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_logs')
        .select('message_type');

      if (error) throw error;

      const stats: Record<string, number> = {};
      (data || []).forEach((log) => {
        stats[log.message_type] = (stats[log.message_type] || 0) + 1;
      });

      setUsageStats(stats);
    } catch (error) {
      console.error('Error fetching usage stats:', error);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.template_key.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(t =>
        filterStatus === 'active' ? t.is_active : !t.is_active
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchTemplates();
      alert('Template deleted successfully');
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  const handleDuplicate = async (template: WhatsAppTemplate) => {
    const newTemplate = {
      ...template,
      template_key: `${template.template_key}_copy`,
      template_name: `${template.template_name} (Copy)`,
      id: undefined,
      created_at: undefined,
      updated_at: undefined
    };

    setEditingTemplate(newTemplate as any);
    setShowModal(true);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      await fetchTemplates();
    } catch (error) {
      console.error('Error toggling template status:', error);
      alert('Failed to update template status');
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
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Message Templates</h3>
            <p className="text-sm text-slate-600 mt-1">{templates.length} total templates</p>
          </div>
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Template
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <div className="space-y-3">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-slate-800">{template.template_name}</h4>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${template.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                      }`}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">
                    <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                      {template.template_key}
                    </span>
                  </p>
                  <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                    {template.message_body}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>
                      {Array.isArray(template.variables) ? template.variables.length : 0} variables
                    </span>
                    <span>
                      Used {usageStats[template.template_key] || 0} times
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(template.id, template.is_active)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${template.is_active
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                  >
                    {template.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDuplicate(template)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingTemplate(template);
                      setShowModal(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">
                {searchQuery || filterStatus !== 'all'
                  ? 'No templates match your filters'
                  : 'No templates yet. Create your first template!'}
              </p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <TemplateFormModal
          template={editingTemplate}
          onClose={() => {
            setShowModal(false);
            setEditingTemplate(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingTemplate(null);
            fetchTemplates();
          }}
        />
      )}
    </div>
  );
};

interface TemplateFormModalProps {
  template: WhatsAppTemplate | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TemplateFormModal: React.FC<TemplateFormModalProps> = ({ template, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    template_key: template?.template_key || '',
    template_name: template?.template_name || '',
    message_body: template?.message_body || '',
    variables: Array.isArray(template?.variables) ? template.variables : [],
    is_active: template?.is_active ?? true
  });
  const [newVariable, setNewVariable] = useState('');
  const [saving, setSaving] = useState(false);
  const [charCount, setCharCount] = useState(template?.message_body.length || 0);

  useEffect(() => {
    setCharCount(formData.message_body.length);
  }, [formData.message_body]);

  const handleAddVariable = () => {
    if (!newVariable.trim()) return;
    if (formData.variables.includes(newVariable.trim())) {
      alert('Variable already exists');
      return;
    }

    setFormData({
      ...formData,
      variables: [...formData.variables, newVariable.trim()]
    });
    setNewVariable('');
  };

  const handleRemoveVariable = (variable: string) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter(v => v !== variable)
    });
  };

  const handleInsertVariable = (variable: string) => {
    const textarea = document.getElementById('message_body') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.message_body;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const placeholder = `{{${variable}}}`;

    setFormData({
      ...formData,
      message_body: before + placeholder + after
    });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.template_key || !formData.template_name || !formData.message_body) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      if (template) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .update({
            template_name: formData.template_name,
            message_body: formData.message_body,
            variables: formData.variables,
            is_active: formData.is_active
          })
          .eq('id', template.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert({
            template_key: formData.template_key,
            template_name: formData.template_name,
            message_body: formData.message_body,
            variables: formData.variables,
            is_active: formData.is_active
          });

        if (error) throw error;
      }

      alert(template ? 'Template updated successfully' : 'Template created successfully');
      onSuccess();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">
            {template ? 'Edit Template' : 'Create Template'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Template Key * <span className="text-xs text-slate-500">(unique identifier)</span>
              </label>
              <input
                type="text"
                value={formData.template_key}
                onChange={(e) => setFormData({ ...formData, template_key: e.target.value })}
                disabled={!!template}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed font-mono text-sm"
                placeholder="registration_success"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Registration Success Message"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Message Body *
              </label>
              <VariableCheatSheet />
            </div>
            <textarea
              id="message_body"
              value={formData.message_body}
              onChange={(e) => setFormData({ ...formData, message_body: e.target.value })}
              rows={8}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
              placeholder="Hello {{nama_lengkap}}, your registration..."
              required
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-500">
                Use {'{{'} and {'}}'} for variables (e.g., {'{{nama_lengkap}}'})
              </p>
              <p className={`text-xs ${charCount > 1000 ? 'text-amber-600' : 'text-slate-500'}`}>
                {charCount} characters {charCount > 1000 && '(long message)'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Variables
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newVariable}
                onChange={(e) => setNewVariable(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariable())}
                placeholder="nama_lengkap"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
              />
              <button
                type="button"
                onClick={handleAddVariable}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Add
              </button>
            </div>

            {formData.variables.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 mb-2">Click to insert into message:</p>
                <div className="flex flex-wrap gap-2">
                  {formData.variables.map((variable) => (
                    <div
                      key={variable}
                      className="group flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-mono"
                    >
                      <button
                        type="button"
                        onClick={() => handleInsertVariable(variable)}
                        className="hover:underline"
                      >
                        {'{{' + variable + '}}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariable(variable)}
                        className="text-emerald-600 hover:text-emerald-800 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-emerald-600 border-slate-300 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
              Active (available for sending)
            </label>
          </div>

          <div className="pt-4 flex gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <Loader className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
