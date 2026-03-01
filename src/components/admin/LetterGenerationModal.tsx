import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Download, Eye, Loader2 } from 'lucide-react';
import {
  generateLetterNumber,
  generateCompleteHTML,
  convertHTMLToPDF
} from '../../lib/letterGenerator';

interface LetterGenerationModalProps {
  applicant: any;
  onClose: () => void;
}

export const LetterGenerationModal: React.FC<LetterGenerationModalProps> = ({
  applicant,
  onClose
}) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewHTML, setPreviewHTML] = useState('');
  const [letterNumber, setLetterNumber] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      alert('Gagal memuat template');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!selectedTemplate) {
      alert('Pilih template terlebih dahulu');
      return;
    }

    try {
      setGenerating(true);

      const number = await generateLetterNumber(
        selectedTemplate.id,
        selectedTemplate.letter_number_config
      );
      setLetterNumber(number);

      const html = generateCompleteHTML(selectedTemplate, applicant, number);
      setPreviewHTML(html);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Gagal generate preview');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setGenerating(true);

      const pdfBlob = await convertHTMLToPDF(previewHTML, `Surat_${applicant.id}.pdf`);

      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Surat_${selectedTemplate.name}_${applicant.dynamic_data?.nama_lengkap || applicant.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;
      const fileName = `${year}/${month}/${applicant.id}_${selectedTemplate.id}_${Date.now()}.pdf`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('generated-letters')
        .upload(fileName, pdfBlob);

      if (uploadError) {
        console.error('Error uploading PDF:', uploadError);
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from('generated_letters')
        .insert({
          applicant_id: applicant.id,
          template_id: selectedTemplate.id,
          letter_number: letterNumber,
          generated_by: user?.id,
          pdf_url: uploadData?.path || '',
          html_content: previewHTML,
          variables_data: applicant.dynamic_data || {},
          status: 'finalized'
        });

      if (insertError) {
        console.error('Error saving letter record:', insertError);
      }

      alert('Surat berhasil digenerate dan disimpan!');
      onClose();
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Gagal generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">Generate Surat</h3>
          <p className="text-sm text-slate-600 mt-1">
            Untuk: {applicant.dynamic_data?.nama_lengkap || applicant.profiles?.full_name || 'N/A'}
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {!showPreview ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Pilih Template Surat
                </label>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <FileText className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                    <p className="text-slate-600">Belum ada template tersedia</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Buat template baru di menu Letter Templates
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className={`p-4 border-2 rounded-xl text-left transition-all hover:shadow-md ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <FileText className={`h-5 w-5 mt-0.5 ${
                            selectedTemplate?.id === template.id ? 'text-blue-600' : 'text-slate-400'
                          }`} />
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-800">{template.name}</h4>
                            {template.description && (
                              <p className="text-sm text-slate-600 mt-1">{template.description}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                              <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                                {template.template_type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTemplate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Template Details</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p><strong>Kop Surat:</strong> {selectedTemplate.letterhead_config?.school_name || 'Tidak ada'}</p>
                    <p><strong>Penandatangan:</strong> {selectedTemplate.signature_config?.signer_name || 'Tidak ada'}</p>
                    <p><strong>Format Nomor:</strong> {selectedTemplate.letter_number_config?.format_pattern || 'Auto'}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-800">Preview Surat</h4>
                  <p className="text-sm text-slate-600">Nomor: {letterNumber}</p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Ganti Template
                </button>
              </div>

              <div className="border-2 border-slate-200 rounded-lg bg-white overflow-auto max-h-[500px]">
                <div
                  className="p-8"
                  dangerouslySetInnerHTML={{ __html: previewHTML }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-between">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {showPreview ? 'Tutup' : 'Batal'}
          </button>

          <div className="flex gap-3">
            {showPreview ? (
              <>
                <button
                  onClick={handleDownloadPDF}
                  disabled={generating}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download PDF
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleGeneratePreview}
                disabled={!selectedTemplate || generating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Generate Preview
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
