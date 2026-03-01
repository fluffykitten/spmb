import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2, CheckCircle } from 'lucide-react';

interface WordTemplateUploaderProps {
  onFileSelect: (file: File) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export const WordTemplateUploader: React.FC<WordTemplateUploaderProps> = ({
  onFileSelect,
  loading = false,
  error = null
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
      alert('Format file tidak didukung! Gunakan file .docx atau .doc');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file terlalu besar! Maksimal 10MB');
      return;
    }

    setSelectedFile(file);
    setProcessingStatus('uploading');

    try {
      await onFileSelect(file);
      setProcessingStatus('done');
    } catch (err) {
      setProcessingStatus('idle');
      setSelectedFile(null);
      console.error('Error processing file:', err);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc']
    },
    maxFiles: 1,
    disabled: loading || processingStatus !== 'idle'
  });

  const handleRemove = () => {
    setSelectedFile(null);
    setProcessingStatus('idle');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (selectedFile && (processingStatus === 'uploading' || processingStatus === 'processing' || loading)) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            <FileText className="h-6 w-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-blue-900">Memproses Dokumen Word...</p>
            <p className="text-sm text-blue-700 mt-1">{selectedFile.name}</p>
            <p className="text-xs text-blue-600 mt-2">
              Menganalisis format, mendeteksi variabel, dan mengkonversi ke HTML...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedFile && processingStatus === 'done') {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900">{selectedFile.name}</p>
              <p className="text-sm text-emerald-700">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
            title="Hapus dan upload ulang"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
          }
          ${(loading || processingStatus !== 'idle') ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          <div className={`p-4 rounded-full ${isDragActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
            <Upload className={`h-8 w-8 ${isDragActive ? 'text-blue-600' : 'text-slate-600'}`} />
          </div>

          <div>
            <p className="text-lg font-semibold text-slate-800">
              {isDragActive ? 'Drop file di sini...' : 'Upload Dokumen Word Template'}
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Drag & drop file .docx atau klik untuk browse
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Format: .docx, .doc
            </span>
            <span>Maksimal: 10MB</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 mb-2">Yang perlu diperhatikan:</h5>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Gunakan format variabel: [nama], {'{'}nama{'}'}, atau {'{{'}nama{'}}'}</li>
          <li>• Variabel akan otomatis dikonversi ke format HURUF_BESAR</li>
          <li>• Tabel akan dikonversi ke HTML table</li>
          <li>• Gambar akan di-embed sebagai base64</li>
          <li>• Format kompleks mungkin tidak terkonversi sempurna</li>
        </ul>
      </div>
    </div>
  );
};
