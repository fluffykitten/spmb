import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface DocxTemplateUploaderProps {
  onFileSelect: (file: File) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export const DocxTemplateUploader: React.FC<DocxTemplateUploaderProps> = ({
  onFileSelect,
  loading = false,
  error = null
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      setStatus('error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file terlalu besar! Maksimal 10MB');
      return;
    }

    setSelectedFile(file);
    setStatus('uploading');

    try {
      await onFileSelect(file);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      console.error('Error processing file:', err);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled: loading || status === 'uploading'
  });

  const handleRemove = () => {
    setSelectedFile(null);
    setStatus('idle');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (selectedFile && (status === 'uploading' || loading)) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            <FileText className="h-6 w-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-blue-900">Memproses Template DOCX...</p>
            <p className="text-sm text-blue-700 mt-1">{selectedFile.name}</p>
            <p className="text-xs text-blue-600 mt-2">
              Mendeteksi variabel dan memvalidasi format...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedFile && status === 'done') {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-900">{selectedFile.name}</p>
              <p className="text-sm text-green-700">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
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
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
          ${(loading || status === 'uploading') ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          <div className={`p-4 rounded-full ${isDragActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Upload className={`h-8 w-8 ${isDragActive ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>

          <div>
            <p className="text-lg font-semibold text-gray-800">
              {isDragActive ? 'Drop file di sini...' : 'Upload Template DOCX'}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Drag & drop file .docx atau klik untuk browse
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Format: .docx
            </span>
            <span>Maksimal: 10MB</span>
          </div>
        </div>
      </div>

      {(error || status === 'error') && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Terjadi Kesalahan</p>
              <p className="text-sm text-red-700 mt-1">
                {error || 'Format file tidak didukung! Gunakan file .docx'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 mb-2">Panduan Membuat Template:</h5>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Gunakan format variabel: {'{'}nama_variabel{'}'}</li>
          <li>• Contoh: {'{'}nama_lengkap{'}'}, {'{'}nisn{'}'}, {'{'}tanggal{'}'}</li>
          <li>• Untuk gambar kop: sisipkan placeholder {'{%'}logo_sekolah{'%}'}</li>
          <li>• Tabel dan format kompleks akan tetap terjaga</li>
          <li>• Hindari menggunakan Text Box atau Shape kompleks</li>
        </ul>
      </div>
    </div>
  );
};
