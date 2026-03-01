import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadDocxTemplate } from '../../lib/docxTemplateManager';
import { DocxTemplateUploader } from './DocxTemplateUploader';
import { DocumentLayoutConfigurator } from './DocumentLayoutConfigurator';
import { X, Save, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { extractVariablesFromDocxFile } from '../../lib/variableMapping';
import { DEFAULT_LAYOUT_CONFIG, DocxLayoutConfig } from '../../lib/layoutConstants';

interface DocxTemplateWizardProps {
  onClose: () => void;
  onSave: () => void;
  template?: any;
}

interface TemplateData {
  name: string;
  description: string;
  template_type: string;
  docx_file: File | null;
  docx_variables: string[];
  access_rule: 'all' | 'status_based' | 'manual';
  required_status: string[];
  is_self_service: boolean;
  generation_limit: number;
  docx_layout_config: DocxLayoutConfig;
}

export const DocxTemplateWizard: React.FC<DocxTemplateWizardProps> = ({
  onClose,
  onSave,
  template
}) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [templateData, setTemplateData] = useState<TemplateData>({
    name: template?.name || '',
    description: template?.description || '',
    template_type: template?.template_type || 'acceptance',
    docx_file: null,
    docx_variables: template?.docx_variables || [],
    access_rule: template?.access_rule || 'status_based',
    required_status: template?.required_status || ['approved'],
    is_self_service: template?.is_self_service ?? true,
    generation_limit: template?.generation_limit || 3,
    docx_layout_config: template?.docx_layout_config || DEFAULT_LAYOUT_CONFIG
  });

  const handleFileSelect = async (file: File) => {
    setUploading(true);
    try {
      const variables = await extractVariablesFromDocxFile(file);

      setTemplateData(prev => ({
        ...prev,
        docx_file: file,
        docx_variables: variables
      }));
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Gagal membaca file DOCX. Pastikan file adalah dokumen DOCX yang valid.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!templateData.name || (!templateData.docx_file && !template?.docx_template_url)) {
      alert('Mohon lengkapi semua field yang wajib diisi (Nama dan File Template)');
      return;
    }

    if (templateData.access_rule === 'status_based' && templateData.required_status.length === 0) {
      alert('Mohon pilih minimal satu status untuk aturan akses berbasis status');
      return;
    }

    setSaving(true);

    try {
      let docxUrl = template?.docx_template_url;

      if (templateData.docx_file) {
        const tempId = template?.id || crypto.randomUUID();
        const uploadResult = await uploadDocxTemplate(templateData.docx_file, tempId);

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Gagal mengupload file template ke storage');
        }

        docxUrl = uploadResult.url;
      }

      if (!docxUrl) {
        throw new Error('URL template tidak ditemukan. Mohon upload file template.');
      }

      const templatePayload = {
        name: templateData.name,
        description: templateData.description || null,
        template_format: 'docx' as const,
        template_type: templateData.template_type,
        docx_template_url: docxUrl,
        docx_variables: templateData.docx_variables,
        docx_layout_config: templateData.docx_layout_config,
        access_rule: templateData.access_rule,
        required_status: templateData.required_status,
        is_self_service: templateData.is_self_service,
        generation_limit: templateData.generation_limit,
        is_active: true,
        html_content: ''
      };

      if (template?.id) {
        const { error } = await supabase
          .from('letter_templates')
          .update(templatePayload)
          .eq('id', template.id);

        if (error) {
          console.error('Supabase update error:', error);
          throw new Error(`Database error: ${error.message}`);
        }
      } else {
        const { error } = await supabase
          .from('letter_templates')
          .insert(templatePayload);

        if (error) {
          console.error('Supabase insert error:', error);
          throw new Error(`Database error: ${error.message}`);
        }
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving template:', error);
      const errorMessage = error?.message || 'Gagal menyimpan template. Silakan coba lagi.';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 1) {
      return templateData.name && (templateData.docx_file || template?.docx_template_url);
    }
    if (step === 2) {
      return true;
    }
    if (step === 3) {
      return true;
    }
    return false;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {template ? 'Edit Template DOCX' : 'Buat Template DOCX Baru'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Step {step} of 3
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Informasi Template</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Template *
                </label>
                <input
                  type="text"
                  value={templateData.name}
                  onChange={(e) => setTemplateData({ ...templateData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Surat Penerimaan Siswa Baru"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  value={templateData.description}
                  onChange={(e) => setTemplateData({ ...templateData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Surat resmi penerimaan untuk siswa yang telah diterima"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipe Template
                </label>
                <select
                  value={templateData.template_type}
                  onChange={(e) => setTemplateData({ ...templateData, template_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="acceptance">Surat Penerimaan</option>
                  <option value="rejection">Surat Penolakan</option>
                  <option value="confirmation">Surat Konfirmasi</option>
                  <option value="certificate">Sertifikat</option>
                  <option value="general">Umum</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Template DOCX *
                </label>
                <DocxTemplateUploader
                  onFileSelect={handleFileSelect}
                  loading={uploading}
                />
              </div>

              {templateData.docx_variables.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Variabel Terdeteksi ({templateData.docx_variables.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {templateData.docx_variables.map((variable, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-white border border-blue-300 text-blue-700 rounded text-xs font-mono"
                      >
                        {'{' + variable + '}'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Aturan Akses & Limit</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aturan Akses
                </label>
                <select
                  value={templateData.access_rule}
                  onChange={(e) => setTemplateData({ ...templateData, access_rule: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Semua Siswa</option>
                  <option value="status_based">Berdasarkan Status</option>
                  <option value="manual">Manual (Admin)</option>
                </select>
              </div>

              {templateData.access_rule === 'status_based' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status yang Diizinkan
                  </label>
                  <div className="space-y-2">
                    {['draft', 'submitted', 'approved', 'rejected'].map((status) => (
                      <label key={status} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={templateData.required_status.includes(status)}
                          onChange={(e) => {
                            const newStatus = e.target.checked
                              ? [...templateData.required_status, status]
                              : templateData.required_status.filter(s => s !== status);
                            setTemplateData({ ...templateData, required_status: newStatus });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={templateData.is_self_service}
                    onChange={(e) => setTemplateData({ ...templateData, is_self_service: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Aktifkan Self-Service (Siswa bisa generate sendiri)
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Limit Generate per Siswa
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={templateData.generation_limit}
                  onChange={(e) => setTemplateData({ ...templateData, generation_limit: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Setiap siswa dapat generate maksimal {templateData.generation_limit}x
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Konfigurasi Layout & Format Dokumen
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Layout ini akan di-enforce saat dokumen digenerate. Semua pengaturan di bawah ini akan otomatis diterapkan ke dokumen DOCX yang dihasilkan.
                </p>
              </div>

              <DocumentLayoutConfigurator
                layoutConfig={templateData.docx_layout_config}
                onChange={(config) => setTemplateData({
                  ...templateData,
                  docx_layout_config: config
                })}
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </button>

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Selanjutnya
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !canProceed()}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan Template
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
