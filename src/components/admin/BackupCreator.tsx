import { useState, useEffect } from 'react';
import { Database, CheckCircle2, Loader2, AlertCircle, Download } from 'lucide-react';
import { getAvailableTables, createBackup, downloadBackup, type TableInfo } from '../../lib/backupService';

export default function BackupCreator() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [backupName, setBackupName] = useState('');
  const [description, setDescription] = useState('');
  const [backupType, setBackupType] = useState<'full' | 'selective'>('full');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<{ table: string; current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; backupId: string } | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (backupType === 'full' && tables.length > 0) {
      setSelectedTables(new Set(tables.map(t => t.table_name)));
    }
  }, [backupType, tables]);

  const loadTables = async () => {
    setLoading(true);
    setError(null);

    try {
      const tableList = await getAvailableTables();
      setTables(tableList);
      setSelectedTables(new Set(tableList.map(t => t.table_name)));
    } catch (err: any) {
      console.error('Error loading tables:', err);
      setError(err.message || 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  const toggleTable = (tableName: string) => {
    if (backupType === 'full') return;

    const newSelection = new Set(selectedTables);
    if (newSelection.has(tableName)) {
      newSelection.delete(tableName);
    } else {
      newSelection.add(tableName);
    }
    setSelectedTables(newSelection);
  };

  const toggleAll = () => {
    if (backupType === 'full') return;

    if (selectedTables.size === tables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(tables.map(t => t.table_name)));
    }
  };

  const handleCreateBackup = async () => {
    if (!backupName.trim()) {
      setError('Please enter a backup name');
      return;
    }

    if (selectedTables.size === 0) {
      setError('Please select at least one table');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);
    setProgress(null);

    try {
      const result = await createBackup(
        backupName,
        description,
        backupType,
        Array.from(selectedTables),
        (prog) => {
          setProgress(prog);
        }
      );

      if (result.success && result.backupId) {
        setSuccess({
          message: 'Backup created successfully!',
          backupId: result.backupId,
        });
        setBackupName('');
        setDescription('');
        setProgress(null);
      } else {
        setError(result.error || 'Failed to create backup');
      }
    } catch (err: any) {
      console.error('Error creating backup:', err);
      setError(err.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadBackup = async () => {
    if (!success?.backupId) return;

    try {
      const blob = await downloadBackup(success.backupId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${backupName.replace(/\s+/g, '_')}_${Date.now()}.json`;
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
    }
  };

  const getTotalRows = () => {
    return tables
      .filter(t => selectedTables.has(t.table_name))
      .reduce((sum, t) => sum + t.row_count, 0);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Create New Backup</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Backup Name *
            </label>
            <input
              type="text"
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="e.g., Weekly Backup 2024-02-14"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={creating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this backup..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={creating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Backup Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="full"
                  checked={backupType === 'full'}
                  onChange={(e) => setBackupType(e.target.value as 'full')}
                  className="mr-2"
                  disabled={creating}
                />
                <span className="text-sm text-gray-700">Full Backup (All Tables)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="selective"
                  checked={backupType === 'selective'}
                  onChange={(e) => setBackupType(e.target.value as 'selective')}
                  className="mr-2"
                  disabled={creating}
                />
                <span className="text-sm text-gray-700">Selective Backup</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Select Tables {backupType === 'full' && '(All Selected)'}
          </h3>
          {backupType === 'selective' && (
            <button
              onClick={toggleAll}
              className="text-sm text-blue-600 hover:text-blue-700"
              disabled={creating}
            >
              {selectedTables.size === tables.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-600">Loading tables...</span>
          </div>
        ) : tables.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No tables found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {tables.map((table) => (
              <label
                key={table.table_name}
                className={`
                  flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all
                  ${selectedTables.has(table.table_name)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${backupType === 'full' || creating ? 'cursor-not-allowed opacity-60' : ''}
                `}
              >
                <div className="flex items-center flex-1">
                  <input
                    type="checkbox"
                    checked={selectedTables.has(table.table_name)}
                    onChange={() => toggleTable(table.table_name)}
                    disabled={backupType === 'full' || creating}
                    className="mr-3"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {table.table_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {table.row_count.toLocaleString()} rows
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Selected: {selectedTables.size} tables
            </span>
            <span className="text-gray-600">
              Total Rows: {getTotalRows().toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {progress && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="font-medium text-blue-900">
              Creating Backup...
            </span>
          </div>
          <div className="text-sm text-blue-700">
            Processing: {progress.table} ({progress.current}/{progress.total} tables)
          </div>
          <div className="mt-2 bg-blue-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

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

      {success && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-green-900">{success.message}</h4>
              <p className="text-sm text-green-700 mt-1">
                Your backup has been created and saved. You can download it now or access it later from the Backup History tab.
              </p>
              <button
                onClick={handleDownloadBackup}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Backup
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={handleCreateBackup}
          disabled={creating || !backupName.trim() || selectedTables.size === 0}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Backup...
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              Create Backup
            </>
          )}
        </button>
      </div>
    </div>
  );
}
