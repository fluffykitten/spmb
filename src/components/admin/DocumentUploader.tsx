import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { uploadApplicantDocument } from '../../lib/documentAccess';
import { AccessRule } from '../../lib/letterAccess';

interface DocumentUploaderProps {
  onUploadComplete: () => void;
}

interface FileWithMetadata {
  file: File;
  name: string;
  description: string;
  accessRule: AccessRule;
  displayOrder: number;
  isActive: boolean;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUploadComplete }) => {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length !== acceptedFiles.length) {
      setError('Only PDF files are allowed');
      setTimeout(() => setError(null), 3000);
    }

    const oversizedFiles = pdfFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError('Some files exceed 10MB limit');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const newFiles = pdfFiles.map(file => ({
      file,
      name: file.name.replace('.pdf', ''),
      description: '',
      accessRule: 'after_submission' as AccessRule,
      displayOrder: files.length,
      isActive: true
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileMetadata = (index: number, updates: Partial<FileWithMetadata>) => {
    setFiles(prev => prev.map((file, i) =>
      i === index ? { ...file, ...updates } : file
    ));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    const progress = new Map<string, number>();

    for (let i = 0; i < files.length; i++) {
      const fileData = files[i];
      progress.set(fileData.file.name, 0);
      setUploadProgress(new Map(progress));

      const { error: uploadError } = await uploadApplicantDocument(fileData.file, {
        name: fileData.name,
        description: fileData.description || undefined,
        access_rule: fileData.accessRule,
        display_order: fileData.displayOrder,
        is_active: fileData.isActive
      });

      if (uploadError) {
        setError(`Failed to upload ${fileData.name}`);
        setUploading(false);
        return;
      }

      progress.set(fileData.file.name, 100);
      setUploadProgress(new Map(progress));
    }

    setUploading(false);
    setFiles([]);
    setUploadProgress(new Map());
    onUploadComplete();
  };

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
          }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          {isDragActive ? 'Drop files here' : 'Drag and drop PDF files here'}
        </p>
        <p className="text-sm text-gray-500">
          or click to select files (max 10MB per file)
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Upload Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Files to Upload ({files.length})
            </h3>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload All'}
            </button>
          </div>

          <div className="space-y-4">
            {files.map((fileData, index) => (
              <div key={`${fileData.file.name}-${index}`} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />

                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Document Name
                      </label>
                      <input
                        type="text"
                        value={fileData.name}
                        onChange={(e) => updateFileMetadata(index, { name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={uploading}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        File: {fileData.file.name} ({(fileData.file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (Optional)
                      </label>
                      <textarea
                        value={fileData.description}
                        onChange={(e) => updateFileMetadata(index, { description: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={uploading}
                        placeholder="Brief description of the document..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Access Rule
                        </label>
                        <select
                          value={fileData.accessRule}
                          onChange={(e) => updateFileMetadata(index, { accessRule: e.target.value as AccessRule })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={uploading}
                        >
                          <option value="always">Tersedia Segera</option>
                          <option value="after_submission">Setelah Submit Pendaftaran</option>
                          <option value="after_approval">Setelah Disetujui</option>
                          <option value="after_rejection">Setelah Ditolak</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Display Order
                        </label>
                        <input
                          type="number"
                          value={fileData.displayOrder}
                          onChange={(e) => updateFileMetadata(index, { displayOrder: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={uploading}
                          min={0}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={fileData.isActive ? 'active' : 'inactive'}
                          onChange={(e) => updateFileMetadata(index, { isActive: e.target.value === 'active' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={uploading}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    {uploadProgress.has(fileData.file.name) && uploadProgress.get(fileData.file.name)! > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress.get(fileData.file.name)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
