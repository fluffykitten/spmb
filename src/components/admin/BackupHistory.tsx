import { useState, useEffect } from 'react';
import { Download, Trash2, RefreshCw, Clock, Database, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { getBackupList, downloadBackup, deleteBackup, formatFileSize, type BackupMetadata } from '../../lib/backupService';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { format } from 'date-fns';

export default function BackupHistory() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<BackupMetadata | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);

    try {
      const backupList = await getBackupList();
      setBackups(backupList);
    } catch (err: any) {
      console.error('Error loading backups:', err);
      setError(err.message || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (backup: BackupMetadata) => {
    setDownloading(backup.id);
    setError(null);

    try {
      const blob = await downloadBackup(backup.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${backup.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError('Failed to download backup file');
      }
    } catch (err: any) {
      console.error('Error downloading backup:', err);
      setError(err.message || 'Failed to download backup');
    } finally {
      setDownloading(null);
    }
  };

  const handleDeleteClick = (backup: BackupMetadata) => {
    setBackupToDelete(backup);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!backupToDelete) return;

    setDeleting(true);
    setError(null);

    try {
      const success = await deleteBackup(backupToDelete.id);
      if (success) {
        setBackups(backups.filter(b => b.id !== backupToDelete.id));
        setDeleteDialogOpen(false);
        setBackupToDelete(null);
      } else {
        setError('Failed to delete backup');
      }
    } catch (err: any) {
      console.error('Error deleting backup:', err);
      setError(err.message || 'Failed to delete backup');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Database className="w-4 h-4" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Backup History</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage and download your database backups
          </p>
        </div>
        <button
          onClick={loadBackups}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading && backups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 border border-gray-200">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Loading backups...</p>
          </div>
        </div>
      ) : backups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 border border-gray-200">
          <div className="flex flex-col items-center justify-center">
            <Database className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Backups Yet</h3>
            <p className="text-gray-600 text-center">
              Create your first backup to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Backup Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tables
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{backup.name}</div>
                        {backup.description && (
                          <div className="text-sm text-gray-500 mt-1">{backup.description}</div>
                        )}
                        {backup.error_message && (
                          <div className="text-sm text-red-600 mt-1">
                            Error: {backup.error_message}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                        {backup.backup_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {Array.isArray(backup.tables_included)
                        ? backup.tables_included.length
                        : 0}{' '}
                      tables
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {backup.file_size ? formatFileSize(backup.file_size) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          backup.status
                        )}`}
                      >
                        {getStatusIcon(backup.status)}
                        {backup.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {format(new Date(backup.created_at), 'MMM d, yyyy HH:mm')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(backup)}
                          disabled={backup.status !== 'completed' || downloading === backup.id}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Download backup"
                        >
                          {downloading === backup.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(backup)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete backup"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteDialogOpen(false);
            setBackupToDelete(null);
          }
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Backup"
        message={`Are you sure you want to delete the backup "${backupToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
