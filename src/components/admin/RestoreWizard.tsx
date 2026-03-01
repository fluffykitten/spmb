import { useState } from 'react';
import { Upload, FileCheck, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { validateBackupFile, restoreBackup, type BackupData, type RestoreProgress } from '../../lib/backupService';
import { ConfirmDialog } from '../shared/ConfirmDialog';

export default function RestoreWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [conflictResolution, setConflictResolution] = useState<'overwrite' | 'skip' | 'merge'>('overwrite');
  const [createSafetyBackup, setCreateSafetyBackup] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress[]>([]);
  const [restoreComplete, setRestoreComplete] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/json': ['.json'],
    },
    multiple: false,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const uploadedFile = acceptedFiles[0];
        setFile(uploadedFile);
        setValidationError(null);
        setBackupData(null);
        setRestoreComplete(false);
        setRestoreError(null);

        setValidating(true);
        const result = await validateBackupFile(uploadedFile);
        setValidating(false);

        if (result.valid && result.data) {
          setBackupData(result.data);
        } else {
          setValidationError(result.error || 'Invalid backup file');
        }
      }
    },
  });

  const handleRestore = () => {
    setConfirmDialogOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!backupData) return;

    setConfirmDialogOpen(false);
    setRestoring(true);
    setRestoreError(null);
    setRestoreProgress([]);
    setRestoreComplete(false);

    const result = await restoreBackup(
      backupData,
      {
        conflictResolution,
        createBackupBeforeRestore: createSafetyBackup,
      },
      (progress) => {
        setRestoreProgress((prev) => {
          const existing = prev.find((p) => p.table === progress.table);
          if (existing) {
            return prev.map((p) => (p.table === progress.table ? progress : p));
          }
          return [...prev, progress];
        });
      }
    );

    setRestoring(false);

    if (result.success) {
      setRestoreComplete(true);
    } else {
      setRestoreError(result.error || 'Failed to restore backup');
    }
  };

  const handleReset = () => {
    setFile(null);
    setBackupData(null);
    setValidationError(null);
    setRestoreProgress([]);
    setRestoreComplete(false);
    setRestoreError(null);
  };

  const getProgressStatus = (progress: RestoreProgress) => {
    if (progress.status === 'completed') {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    } else if (progress.status === 'failed') {
      return <XCircle className="w-5 h-5 text-red-600" />;
    } else if (progress.status === 'processing') {
      return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
    return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
  };

  return (
    <div className="space-y-6">
      {!restoring && !restoreComplete && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-start gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Important Warning</h3>
              <p className="text-sm text-gray-600 mt-2">
                Restoring a backup will modify your database. Make sure you understand the implications:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1 ml-4">
                <li>Existing data may be overwritten or modified</li>
                <li>This operation cannot be easily undone</li>
                <li>Consider creating a safety backup before proceeding</li>
                <li>Ensure the backup file is from a trusted source</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {!file && !restoring && !restoreComplete && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Backup File</h2>

          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
              ${isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-700 font-medium mb-2">
              {isDragActive ? 'Drop your backup file here' : 'Drop backup file here or click to browse'}
            </p>
            <p className="text-sm text-gray-500">
              Accepts JSON backup files only
            </p>
          </div>
        </div>
      )}

      {validating && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="text-gray-700">Validating backup file...</span>
          </div>
        </div>
      )}

      {validationError && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900">Validation Failed</h4>
              <p className="text-sm text-red-700 mt-1">{validationError}</p>
              <button
                onClick={handleReset}
                className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Try another file
              </button>
            </div>
          </div>
        </div>
      )}

      {backupData && !restoring && !restoreComplete && (
        <>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-start gap-3 mb-6">
              <FileCheck className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Backup File Validated</h3>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Backup Name:</span>
                    <p className="font-medium text-gray-900">{backupData.metadata.backup_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Created:</span>
                    <p className="font-medium text-gray-900">
                      {new Date(backupData.metadata.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Type:</span>
                    <p className="font-medium text-gray-900 capitalize">{backupData.metadata.backup_type}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Tables:</span>
                    <p className="font-medium text-gray-900">{Object.keys(backupData.tables).length} tables</p>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-sm text-gray-600 block mb-2">Tables to restore:</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(backupData.tables).map(([tableName, rows]) => (
                      <span
                        key={tableName}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tableName} ({rows.length} rows)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Restore Options</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conflict Resolution
                </label>
                <div className="space-y-2">
                  <label className="flex items-start">
                    <input
                      type="radio"
                      value="overwrite"
                      checked={conflictResolution === 'overwrite'}
                      onChange={(e) => setConflictResolution(e.target.value as 'overwrite')}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-900">Overwrite</div>
                      <div className="text-xs text-gray-600">
                        Delete all existing data in the tables before restoring
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start">
                    <input
                      type="radio"
                      value="merge"
                      checked={conflictResolution === 'merge'}
                      onChange={(e) => setConflictResolution(e.target.value as 'merge')}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-900">Merge</div>
                      <div className="text-xs text-gray-600">
                        Update existing records and insert new ones (recommended)
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start">
                    <input
                      type="radio"
                      value="skip"
                      checked={conflictResolution === 'skip'}
                      onChange={(e) => setConflictResolution(e.target.value as 'skip')}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-900">Skip</div>
                      <div className="text-xs text-gray-600">
                        Only insert new records, skip existing ones
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={createSafetyBackup}
                    onChange={(e) => setCreateSafetyBackup(e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      Create safety backup before restore
                    </div>
                    <div className="text-xs text-gray-600">
                      Automatically backup current data before restoring (highly recommended)
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRestore}
              className="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Restore Backup
            </button>
          </div>
        </>
      )}

      {restoring && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900">Restoring Backup...</h3>
          </div>

          <div className="space-y-3">
            {restoreProgress.map((progress) => (
              <div key={progress.table} className="flex items-center gap-3">
                {getProgressStatus(progress)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{progress.table}</span>
                    <span className="text-xs text-gray-600">
                      {progress.processed} / {progress.total} rows
                    </span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        progress.status === 'completed'
                          ? 'bg-green-600'
                          : progress.status === 'failed'
                          ? 'bg-red-600'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {restoreComplete && (
        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900">Restore Completed Successfully</h3>
              <p className="text-sm text-green-700 mt-2">
                Your database has been restored from the backup file. All tables have been updated.
              </p>
              <button
                onClick={handleReset}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Restore Another Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreError && (
        <div className="bg-red-50 rounded-lg p-6 border border-red-200">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900">Restore Failed</h3>
              <p className="text-sm text-red-700 mt-2">{restoreError}</p>
              <button
                onClick={handleReset}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleRestoreConfirm}
        title="Confirm Database Restore"
        message={`Are you sure you want to restore the backup "${backupData?.metadata.backup_name}"? This will ${
          conflictResolution === 'overwrite' ? 'DELETE and replace' : 'modify'
        } your current database data.`}
        confirmText="Yes, Restore Backup"
        variant="warning"
      />
    </div>
  );
}
