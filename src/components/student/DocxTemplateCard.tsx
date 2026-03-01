import React, { useState, useEffect } from 'react';
import { FileText, Download, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { DocxTemplate, GenerationStatus, checkGenerationLimit, incrementGenerationCount, getApplicantData } from '../../lib/docxTemplateManager';
import { generateAndDownloadDocx, getLetterheadConfig } from '../../lib/docxGenerator';
import { mapApplicantDataToVariables, validateRequiredVariables, formatVariableForDisplay } from '../../lib/variableMapping';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface DocxTemplateCardProps {
  template: DocxTemplate;
  applicantId: string;
  onGenerateComplete?: () => void;
}

export const DocxTemplateCard: React.FC<DocxTemplateCardProps> = ({
  template,
  applicantId,
  onGenerateComplete
}) => {
  const { user } = useAuth();
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    loadGenerationStatus();
  }, [applicantId, template.id]);

  const loadGenerationStatus = async () => {
    setLoadingStatus(true);
    const status = await checkGenerationLimit(applicantId, template.id);
    setGenerationStatus(status);
    setLoadingStatus(false);
  };

  const handleGenerate = async () => {
    if (!user || !generationStatus?.canGenerate) return;

    setGenerating(true);

    try {
      const applicantData = await getApplicantData(user.id);

      if (!applicantData) {
        throw new Error('Data pendaftar tidak ditemukan');
      }

      const variables = mapApplicantDataToVariables(applicantData);

      const validation = validateRequiredVariables(variables, template.docx_variables);

      if (!validation.valid && validation.missingVariables.length > 0) {
        const missingVarsDisplay = validation.missingVariables
          .map(v => formatVariableForDisplay(v))
          .join(', ');

        alert(
          `Data berikut belum lengkap:\n${missingVarsDisplay}\n\nSilakan lengkapi data Anda terlebih dahulu di halaman profil/pendaftaran.`
        );
        setGenerating(false);
        return;
      }

      const letterheadConfig = await getLetterheadConfig();

      const fileName = `${variables.nama_lengkap || 'Dokumen'}_${template.name}`.replace(/\s+/g, '_');

      const result = await generateAndDownloadDocx({
        templateUrl: template.docx_template_url!,
        variables,
        letterheadConfig: letterheadConfig || undefined,
        layoutConfig: template.docx_layout_config,
        fileName
      });

      if (result.success) {
        await incrementGenerationCount(applicantId, template.id, undefined, result.fileSize);

        await supabase.rpc('track_document_generation_download', {
          p_applicant_id: applicantId,
          p_template_id: template.id
        });

        await loadGenerationStatus();

        setShowConfirm(false);

        if (onGenerateComplete) {
          onGenerateComplete();
        }

        alert('Dokumen berhasil di-generate dan diunduh!');
      } else {
        throw new Error(result.error || 'Gagal generate dokumen');
      }
    } catch (error) {
      console.error('Error generating document:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat generate dokumen. Silakan coba lagi.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      acceptance: 'Surat Penerimaan',
      rejection: 'Surat Penolakan',
      confirmation: 'Surat Konfirmasi',
      certificate: 'Sertifikat',
      general: 'Umum'
    };
    return labels[type] || type;
  };

  if (loadingStatus) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg flex-shrink-0">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                )}
              </div>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs whitespace-nowrap">
                {getTypeLabel(template.template_type)}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                Format: DOCX (Word)
              </span>
              <span>
                Variabel: {template.docx_variables.length}
              </span>
            </div>

            {generationStatus && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="text-sm">
                  {generationStatus.canGenerate ? (
                    <span className="text-green-700 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Sisa: {generationStatus.remainingCount}x dari {generationStatus.limit}x
                    </span>
                  ) : (
                    <span className="text-red-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Limit tercapai ({generationStatus.limit}x)
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={!generationStatus.canGenerate || generating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Generate & Unduh
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Konfirmasi Generate Dokumen
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Anda akan men-generate dokumen <strong>{template.name}</strong>.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Perhatian:</p>
                    <ul className="space-y-1">
                      <li>• Anda memiliki sisa {generationStatus?.remainingCount}x kesempatan generate</li>
                      <li>• Pastikan data Anda sudah lengkap dan benar</li>
                      <li>• Dokumen akan otomatis terisi dengan data Anda</li>
                      <li>• File akan diunduh dalam format .docx dengan format asli tetap utuh</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={generating}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Ya, Generate'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
