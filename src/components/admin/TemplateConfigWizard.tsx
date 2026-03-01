import React, { useState } from 'react';
import { Upload, FileText, Type, Hash, FileSignature, Layout } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDropzone } from 'react-dropzone';
import { WordTemplateUploader } from './WordTemplateUploader';
import { ComplexContentWarningDialog } from './ComplexContentWarningDialog';
import { VariableConfirmationStep } from './VariableConfirmationStep';
import { parseWordTemplate, DetectedVariable, replaceVariablesInHTML } from '../../lib/wordTemplateParser';

interface TemplateConfigWizardProps {
  template: any | null;
  onClose: () => void;
  onSave: () => void;
}

export const TemplateConfigWizard: React.FC<TemplateConfigWizardProps> = ({
  template,
  onClose,
  onSave
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [htmlContent, setHtmlContent] = useState(template?.html_content || '');
  const [templateType, setTemplateType] = useState(template?.template_type || 'general');
  const [accessRule, setAccessRule] = useState(template?.access_rule || 'after_submission');
  const [isAvailableForStudents, setIsAvailableForStudents] = useState(template?.is_available_for_students ?? true);

  const [letterheadConfig, setLetterheadConfig] = useState(
    template?.letterhead_config || {
      school_name: '',
      foundation_name: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      school_logo_url: '',
      foundation_logo_url: '',
      letterhead_type: 'school',
      logo_position: 'center',
      logo_size: 80
    }
  );

  const [typographyConfig, setTypographyConfig] = useState(
    template?.typography_config || {
      font_family: 'Times New Roman',
      title_font_size: 14,
      body_font_size: 12,
      line_height: 1.5,
      paragraph_spacing: 12,
      text_align: 'justify',
      title_bold: true,
      title_underline: false
    }
  );

  const [letterNumberConfig, setLetterNumberConfig] = useState(
    template?.letter_number_config || {
      prefix: '001',
      separator: '/',
      middle_code: 'PPDB',
      suffix: '2025',
      format_pattern: '{counter}/{middle}/{suffix}',
      counter_reset: 'yearly',
      auto_increment: true
    }
  );

  const [signatureConfig, setSignatureConfig] = useState(
    template?.signature_config || {
      signer_name: '',
      signer_title: 'Kepala Sekolah',
      signer_nip: '',
      signature_image_url: '',
      show_signature_image: false,
      show_stamp: false,
      stamp_image_url: '',
      signature_position: 'right',
      signature_city: '',
      show_date: true
    }
  );

  const [layoutConfig, setLayoutConfig] = useState(
    template?.layout_config || {
      page_size: 'A4',
      margin_top: 2.5,
      margin_bottom: 2.5,
      margin_left: 3,
      margin_right: 3,
      orientation: 'portrait',
      show_page_number: false,
      watermark_text: '',
      watermark_opacity: 0.1
    }
  );

  const [saving, setSaving] = useState(false);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detectedVariables, setDetectedVariables] = useState<DetectedVariable[]>([]);
  const [showComplexWarning, setShowComplexWarning] = useState(false);
  const [complexElements, setComplexElements] = useState<any[]>([]);
  const [pendingParsedHtml, setPendingParsedHtml] = useState<string>('');
  const [showVariableConfirmation, setShowVariableConfirmation] = useState(false);

  const onDropLogo = async (acceptedFiles: File[], type: 'school' | 'foundation') => {
    const file = acceptedFiles[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('letterhead-assets')
      .upload(filePath, file);

    if (uploadError) {
      alert('Gagal upload logo');
      return;
    }

    const { data } = supabase.storage
      .from('letterhead-assets')
      .getPublicUrl(filePath);

    setLetterheadConfig({
      ...letterheadConfig,
      [type === 'school' ? 'school_logo_url' : 'foundation_logo_url']: data.publicUrl
    });
  };

  const { getRootProps: getSchoolLogoProps, getInputProps: getSchoolLogoInput } = useDropzone({
    onDrop: (files) => onDropLogo(files, 'school'),
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg'] },
    maxFiles: 1
  });

  const { getRootProps: getFoundationLogoProps, getInputProps: getFoundationLogoInput } = useDropzone({
    onDrop: (files) => onDropLogo(files, 'foundation'),
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg'] },
    maxFiles: 1
  });

  const handleWordFileSelect = async (file: File) => {
    try {
      setUploading(true);
      setUploadError(null);
      setUploadedFile(file);

      const parsed = await parseWordTemplate(file);

      if (parsed.hasComplexFormatting) {
        setPendingParsedHtml(parsed.htmlContent);
        setDetectedVariables(parsed.variables);
        setComplexElements(parsed.complexElements);
        setShowComplexWarning(true);
      } else {
        setHtmlContent(parsed.htmlContent);
        setDetectedVariables(parsed.variables);
        if (parsed.variables.length > 0) {
          setShowVariableConfirmation(true);
          setStep(1.5);
        } else {
          setStep(2);
        }
      }
    } catch (error) {
      console.error('Error parsing Word document:', error);
      setUploadError('Gagal memproses dokumen Word. Pastikan format file benar.');
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleComplexWarningContinue = () => {
    setHtmlContent(pendingParsedHtml);
    setShowComplexWarning(false);
    if (detectedVariables.length > 0) {
      setShowVariableConfirmation(true);
      setStep(1.5);
    } else {
      setStep(2);
    }
  };

  const handleComplexWarningCancel = () => {
    setShowComplexWarning(false);
    setUploadedFile(null);
    setPendingParsedHtml('');
    setDetectedVariables([]);
    setComplexElements([]);
  };

  const handleVariablesChange = (variables: DetectedVariable[]) => {
    setDetectedVariables(variables);
    const updatedHtml = replaceVariablesInHTML(htmlContent, variables);
    setHtmlContent(updatedHtml);
  };

  const handleVariableConfirmationNext = () => {
    setShowVariableConfirmation(false);
    setStep(2);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const variables = (htmlContent.match(/\{\{([^}]+)\}\}/g) || []).map(v => v);

      const templateData = {
        name,
        description,
        html_content: htmlContent,
        template_type: templateType,
        variables,
        access_rule: accessRule,
        is_available_for_students: isAvailableForStudents,
        letterhead_config: letterheadConfig,
        typography_config: typographyConfig,
        letter_number_config: letterNumberConfig,
        signature_config: signatureConfig,
        layout_config: layoutConfig
      };

      if (template) {
        const { error } = await supabase
          .from('letter_templates')
          .update(templateData)
          .eq('id', template.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('letter_templates')
          .insert(templateData);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Gagal menyimpan template');
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    if (showVariableConfirmation && step === 1.5) {
      return (
        <VariableConfirmationStep
          variables={detectedVariables}
          htmlContent={htmlContent}
          onVariablesChange={handleVariablesChange}
        />
      );
    }

    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informasi Dasar Template
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nama Template *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Surat Penerimaan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipe Template
                </label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="general">General</option>
                  <option value="acceptance">Surat Penerimaan</option>
                  <option value="requirement">Surat Persyaratan Berkas</option>
                  <option value="responsibility">Surat Pertanggungjawaban Mutlak</option>
                  <option value="statement">Surat Pernyataan Siswa</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Deskripsi
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Deskripsi singkat template..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Akses Surat untuk Siswa
                </label>
                <select
                  value={accessRule}
                  onChange={(e) => setAccessRule(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="always">Tersedia Segera</option>
                  <option value="after_submission">Setelah Submit Pendaftaran</option>
                  <option value="after_approval">Setelah Disetujui</option>
                  <option value="after_rejection">Setelah Ditolak</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Kapan siswa dapat mengunduh surat ini
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tampilkan ke Siswa
                </label>
                <div className="flex items-center gap-3 h-10">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAvailableForStudents}
                      onChange={(e) => setIsAvailableForStudents(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Surat dapat diakses siswa</span>
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Nonaktifkan untuk menyembunyikan surat
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Upload Dokumen Word Template *
              </label>
              <WordTemplateUploader
                onFileSelect={handleWordFileSelect}
                loading={uploading}
                error={uploadError}
              />
              <p className="text-xs text-slate-500 mt-2">
                Upload file .docx dengan variabel seperti: {'{{nama_lengkap}}'}, {'{{nisn}}'}, {'{{nomor_surat}}'}, {'{{tanggal}}'}
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Konfigurasi Kop Surat
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nama Sekolah
                </label>
                <input
                  type="text"
                  value={letterheadConfig.school_name}
                  onChange={(e) => setLetterheadConfig({ ...letterheadConfig, school_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nama Yayasan
                </label>
                <input
                  type="text"
                  value={letterheadConfig.foundation_name}
                  onChange={(e) => setLetterheadConfig({ ...letterheadConfig, foundation_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Alamat
              </label>
              <input
                type="text"
                value={letterheadConfig.address}
                onChange={(e) => setLetterheadConfig({ ...letterheadConfig, address: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Telepon
                </label>
                <input
                  type="text"
                  value={letterheadConfig.phone}
                  onChange={(e) => setLetterheadConfig({ ...letterheadConfig, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={letterheadConfig.email}
                  onChange={(e) => setLetterheadConfig({ ...letterheadConfig, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Website
                </label>
                <input
                  type="text"
                  value={letterheadConfig.website}
                  onChange={(e) => setLetterheadConfig({ ...letterheadConfig, website: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Logo Sekolah
                </label>
                <div
                  {...getSchoolLogoProps()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <input {...getSchoolLogoInput()} />
                  {letterheadConfig.school_logo_url ? (
                    <img src={letterheadConfig.school_logo_url} alt="School Logo" className="max-h-20 mx-auto" />
                  ) : (
                    <p className="text-sm text-slate-600">Klik atau drag logo sekolah</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Logo Yayasan
                </label>
                <div
                  {...getFoundationLogoProps()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <input {...getFoundationLogoInput()} />
                  {letterheadConfig.foundation_logo_url ? (
                    <img src={letterheadConfig.foundation_logo_url} alt="Foundation Logo" className="max-h-20 mx-auto" />
                  ) : (
                    <p className="text-sm text-slate-600">Klik atau drag logo yayasan</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <Type className="h-5 w-5" />
              Konfigurasi Typography
            </h4>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Font Family
                </label>
                <select
                  value={typographyConfig.font_family}
                  onChange={(e) => setTypographyConfig({ ...typographyConfig, font_family: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Arial">Arial</option>
                  <option value="Calibri">Calibri</option>
                  <option value="Georgia">Georgia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ukuran Font Judul (pt)
                </label>
                <input
                  type="number"
                  value={typographyConfig.title_font_size}
                  onChange={(e) => setTypographyConfig({ ...typographyConfig, title_font_size: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ukuran Font Isi (pt)
                </label>
                <input
                  type="number"
                  value={typographyConfig.body_font_size}
                  onChange={(e) => setTypographyConfig({ ...typographyConfig, body_font_size: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Text Align
                </label>
                <select
                  value={typographyConfig.text_align}
                  onChange={(e) => setTypographyConfig({ ...typographyConfig, text_align: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                  <option value="justify">Justify</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Line Height
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={typographyConfig.line_height}
                  onChange={(e) => setTypographyConfig({ ...typographyConfig, line_height: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Format Nomor Surat
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Separator
                </label>
                <input
                  type="text"
                  value={letterNumberConfig.separator}
                  onChange={(e) => setLetterNumberConfig({ ...letterNumberConfig, separator: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="/"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kode Tengah
                </label>
                <input
                  type="text"
                  value={letterNumberConfig.middle_code}
                  onChange={(e) => setLetterNumberConfig({ ...letterNumberConfig, middle_code: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="PPDB"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Format Pattern
              </label>
              <input
                type="text"
                value={letterNumberConfig.format_pattern}
                onChange={(e) => setLetterNumberConfig({ ...letterNumberConfig, format_pattern: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="{counter}/{middle}/{suffix}"
              />
              <p className="text-xs text-slate-500 mt-2">
                Gunakan: {'{counter}'}, {'{middle}'}, {'{suffix}'}, {'{year}'}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium">Preview Nomor Surat:</p>
              <p className="text-lg font-mono text-blue-700 mt-2">
                001{letterNumberConfig.separator}{letterNumberConfig.middle_code}{letterNumberConfig.separator}{new Date().getFullYear()}
              </p>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Konfigurasi Tanda Tangan
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nama Penandatangan
                </label>
                <input
                  type="text"
                  value={signatureConfig.signer_name}
                  onChange={(e) => setSignatureConfig({ ...signatureConfig, signer_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Jabatan
                </label>
                <input
                  type="text"
                  value={signatureConfig.signer_title}
                  onChange={(e) => setSignatureConfig({ ...signatureConfig, signer_title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  NIP/NIK
                </label>
                <input
                  type="text"
                  value={signatureConfig.signer_nip}
                  onChange={(e) => setSignatureConfig({ ...signatureConfig, signer_nip: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kota
                </label>
                <input
                  type="text"
                  value={signatureConfig.signature_city}
                  onChange={(e) => setSignatureConfig({ ...signatureConfig, signature_city: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Posisi TTD
                </label>
                <select
                  value={signatureConfig.signature_position}
                  onChange={(e) => setSignatureConfig({ ...signatureConfig, signature_position: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="left">Kiri</option>
                  <option value="center">Tengah</option>
                  <option value="right">Kanan</option>
                </select>
              </div>

              <div className="flex items-center gap-4 pt-8">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={signatureConfig.show_date}
                    onChange={(e) => setSignatureConfig({ ...signatureConfig, show_date: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-slate-700">Tampilkan Tanggal</span>
                </label>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Konfigurasi Layout Halaman
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ukuran Kertas
                </label>
                <select
                  value={layoutConfig.page_size}
                  onChange={(e) => setLayoutConfig({ ...layoutConfig, page_size: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Orientasi
                </label>
                <select
                  value={layoutConfig.orientation}
                  onChange={(e) => setLayoutConfig({ ...layoutConfig, orientation: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Margin Atas (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={layoutConfig.margin_top}
                  onChange={(e) => setLayoutConfig({ ...layoutConfig, margin_top: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Margin Bawah (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={layoutConfig.margin_bottom}
                  onChange={(e) => setLayoutConfig({ ...layoutConfig, margin_bottom: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Margin Kiri (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={layoutConfig.margin_left}
                  onChange={(e) => setLayoutConfig({ ...layoutConfig, margin_left: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Margin Kanan (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={layoutConfig.margin_right}
                  onChange={(e) => setLayoutConfig({ ...layoutConfig, margin_right: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const steps = [
    { number: 1, title: 'Informasi Dasar' },
    { number: 2, title: 'Kop Surat' },
    { number: 3, title: 'Typography' },
    { number: 4, title: 'Nomor Surat' },
    { number: 5, title: 'Tanda Tangan' },
    { number: 6, title: 'Layout' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">
            {template ? 'Edit Template' : 'Buat Template Baru'}
          </h3>
          <p className="text-sm text-slate-600 mt-1">Step {step} of 6</p>

          <div className="flex gap-2 mt-4">
            {steps.map((s) => (
              <div
                key={s.number}
                className={`flex-1 h-2 rounded-full ${
                  s.number <= step ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {renderStepContent()}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-between">
          <button
            onClick={() => {
              if (step === 1.5) {
                setShowVariableConfirmation(false);
                setStep(1);
              } else if (step > 1) {
                setStep(step - 1);
              } else {
                onClose();
              }
            }}
            disabled={saving}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {step === 1.5 ? 'Kembali' : step > 1 ? 'Sebelumnya' : 'Batal'}
          </button>

          {step === 1.5 ? (
            <button
              onClick={handleVariableConfirmationNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Lanjutkan ke Kop Surat
            </button>
          ) : step < 6 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={
                step === 1
                  ? (!name || !htmlContent || uploading)
                  : !htmlContent
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Memproses...' : 'Selanjutnya'}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !name || !htmlContent}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Template'}
            </button>
          )}
        </div>
      </div>

      <ComplexContentWarningDialog
        isOpen={showComplexWarning}
        complexElements={complexElements}
        onContinue={handleComplexWarningContinue}
        onCancel={handleComplexWarningCancel}
      />
    </div>
  );
};
