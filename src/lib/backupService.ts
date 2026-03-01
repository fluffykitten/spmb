import { supabase } from './supabase';

export interface BackupMetadata {
  id: string;
  name: string;
  description?: string;
  backup_type: 'full' | 'selective';
  tables_included: string[];
  file_path?: string;
  file_size?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_by?: string;
  created_at: string;
  error_message?: string;
}

export interface TableInfo {
  table_name: string;
  row_count: number;
}

export interface BackupData {
  metadata: {
    backup_name: string;
    backup_type: 'full' | 'selective';
    created_at: string;
    version: string;
  };
  tables: {
    [tableName: string]: any[];
  };
}

export interface RestoreProgress {
  table: string;
  processed: number;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

const BACKUP_VERSION = '1.0.0';

const SYSTEM_TABLES = [
  'audit_logs',
  'database_backups',
  'backup_schedules',
];

const TABLE_DEPENDENCIES: { [key: string]: string[] } = {
  applicants: ['profiles', 'registration_batches'],
  generated_letters: ['applicants', 'letter_templates', 'profiles'],
  letter_number_counters: ['letter_templates'],
  applicant_documents: ['applicants', 'profiles'],
  document_generations: ['applicants', 'letter_templates'],
  interview_requests: ['applicants', 'interviewers', 'profiles'],
  interview_sessions: ['interviewers', 'profiles'],
  interview_bookings: ['applicants', 'interview_sessions'],
  exam_attempts: ['applicants', 'exams', 'exam_tokens'],
  exam_results: ['exam_attempts', 'profiles'],
  exam_tokens: ['exams', 'applicants', 'profiles'],
  exam_questions: ['exams'],
  payment_records: ['applicants', 'profiles'],
  payment_history: ['payment_records', 'profiles'],
};

export async function getAvailableTables(): Promise<TableInfo[]> {
  console.log('[BackupService] Fetching available tables...');

  try {
    const { data, error } = await supabase.rpc('get_user_tables_info');

    if (error) {
      console.error('[BackupService] Error fetching tables:', error);
      const tables = await getTablesFromSchema();
      return tables;
    }

    const filteredTables = (data || []).filter(
      (table: TableInfo) => !SYSTEM_TABLES.includes(table.table_name)
    );

    console.log(`[BackupService] Found ${filteredTables.length} tables`);
    return filteredTables;
  } catch (err) {
    console.error('[BackupService] Exception fetching tables:', err);
    const tables = await getTablesFromSchema();
    return tables;
  }
}

async function getTablesFromSchema(): Promise<TableInfo[]> {
  const commonTables = [
    'profiles',
    'applicants',
    'letter_templates',
    'generated_letters',
    'form_schemas',
    'app_config',
    'slideshow_images',
    'letter_number_counters',
    'applicant_documents',
    'document_generations',
    'interview_requests',
    'interview_sessions',
    'interview_bookings',
    'interviewers',
    'exams',
    'exam_questions',
    'exam_attempts',
    'exam_results',
    'exam_tokens',
    'whatsapp_templates',
    'whatsapp_logs',
    'payment_records',
    'payment_history',
    'registration_batches',
    'registration_counters',
  ];

  const tables: TableInfo[] = [];

  for (const tableName of commonTables) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        tables.push({
          table_name: tableName,
          row_count: count || 0,
        });
      }
    } catch (err) {
      console.log(`[BackupService] Table ${tableName} not accessible or doesn't exist`);
    }
  }

  return tables;
}

export async function createBackup(
  name: string,
  description: string,
  backupType: 'full' | 'selective',
  selectedTables: string[],
  onProgress?: (progress: { table: string; current: number; total: number }) => void
): Promise<{ success: boolean; backupId?: string; error?: string }> {
  console.log(`[BackupService] Creating ${backupType} backup: ${name}`);
  console.log('[BackupService] Tables to backup:', selectedTables);

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('User not authenticated');
    }

    const { data: backupRecord, error: createError } = await supabase
      .from('database_backups')
      .insert({
        name,
        description,
        backup_type: backupType,
        tables_included: selectedTables,
        status: 'processing',
        created_by: user.user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('[BackupService] Error creating backup record:', createError);
      throw createError;
    }

    console.log('[BackupService] Backup record created:', backupRecord.id);

    const backupData: BackupData = {
      metadata: {
        backup_name: name,
        backup_type: backupType,
        created_at: new Date().toISOString(),
        version: BACKUP_VERSION,
      },
      tables: {},
    };

    const sortedTables = sortTablesByDependency(selectedTables);
    console.log('[BackupService] Table export order:', sortedTables);

    for (let i = 0; i < sortedTables.length; i++) {
      const tableName = sortedTables[i];
      console.log(`[BackupService] Exporting table ${i + 1}/${sortedTables.length}: ${tableName}`);

      if (onProgress) {
        onProgress({
          table: tableName,
          current: i + 1,
          total: sortedTables.length,
        });
      }

      try {
        const { data, error } = await supabase.from(tableName).select('*');

        if (error) {
          console.error(`[BackupService] Error exporting table ${tableName}:`, error);
          throw error;
        }

        backupData.tables[tableName] = data || [];
        console.log(`[BackupService] Exported ${(data || []).length} rows from ${tableName}`);
      } catch (err) {
        console.error(`[BackupService] Exception exporting table ${tableName}:`, err);
        throw err;
      }
    }

    const backupJSON = JSON.stringify(backupData, null, 2);
    const backupBlob = new Blob([backupJSON], { type: 'application/json' });
    const fileName = `backup_${backupRecord.id}_${Date.now()}.json`;

    console.log(`[BackupService] Uploading backup file: ${fileName} (${backupBlob.size} bytes)`);

    const { error: uploadError } = await supabase.storage
      .from('database-backups')
      .upload(fileName, backupBlob, {
        contentType: 'application/json',
        upsert: false,
      });

    if (uploadError) {
      console.error('[BackupService] Error uploading backup file:', uploadError);
      throw uploadError;
    }

    console.log('[BackupService] Backup file uploaded successfully');

    const { error: updateError } = await supabase
      .from('database_backups')
      .update({
        status: 'completed',
        file_path: fileName,
        file_size: backupBlob.size,
      })
      .eq('id', backupRecord.id);

    if (updateError) {
      console.error('[BackupService] Error updating backup record:', updateError);
    }

    console.log('[BackupService] Backup completed successfully');

    return { success: true, backupId: backupRecord.id };
  } catch (error: any) {
    console.error('[BackupService] Backup failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to create backup',
    };
  }
}

export async function getBackupList(): Promise<BackupMetadata[]> {
  console.log('[BackupService] Fetching backup list...');

  const { data, error } = await supabase
    .from('database_backups')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[BackupService] Error fetching backups:', error);
    throw error;
  }

  console.log(`[BackupService] Found ${(data || []).length} backups`);
  return data || [];
}

export async function downloadBackup(backupId: string): Promise<Blob | null> {
  console.log(`[BackupService] Downloading backup: ${backupId}`);

  const { data: backup, error: fetchError } = await supabase
    .from('database_backups')
    .select('file_path')
    .eq('id', backupId)
    .single();

  if (fetchError || !backup?.file_path) {
    console.error('[BackupService] Error fetching backup metadata:', fetchError);
    return null;
  }

  const { data, error } = await supabase.storage
    .from('database-backups')
    .download(backup.file_path);

  if (error) {
    console.error('[BackupService] Error downloading backup file:', error);
    return null;
  }

  console.log('[BackupService] Backup downloaded successfully');
  return data;
}

export async function deleteBackup(backupId: string): Promise<boolean> {
  console.log(`[BackupService] Deleting backup: ${backupId}`);

  const { data: backup, error: fetchError } = await supabase
    .from('database_backups')
    .select('file_path')
    .eq('id', backupId)
    .single();

  if (fetchError) {
    console.error('[BackupService] Error fetching backup:', fetchError);
    return false;
  }

  if (backup?.file_path) {
    const { error: storageError } = await supabase.storage
      .from('database-backups')
      .remove([backup.file_path]);

    if (storageError) {
      console.error('[BackupService] Error deleting backup file from storage:', storageError);
    }
  }

  const { error: deleteError } = await supabase
    .from('database_backups')
    .delete()
    .eq('id', backupId);

  if (deleteError) {
    console.error('[BackupService] Error deleting backup record:', deleteError);
    return false;
  }

  console.log('[BackupService] Backup deleted successfully');
  return true;
}

export async function validateBackupFile(file: File): Promise<{
  valid: boolean;
  error?: string;
  data?: BackupData;
}> {
  console.log('[BackupService] Validating backup file...');

  try {
    const text = await file.text();
    const data = JSON.parse(text) as BackupData;

    if (!data.metadata || !data.tables) {
      return {
        valid: false,
        error: 'Invalid backup file format: missing metadata or tables',
      };
    }

    if (!data.metadata.backup_name || !data.metadata.created_at) {
      return {
        valid: false,
        error: 'Invalid backup metadata',
      };
    }

    console.log('[BackupService] Backup file is valid');
    console.log(`[BackupService] Backup contains ${Object.keys(data.tables).length} tables`);

    return { valid: true, data };
  } catch (error: any) {
    console.error('[BackupService] Error validating backup file:', error);
    return {
      valid: false,
      error: `Invalid JSON file: ${error.message}`,
    };
  }
}

export async function restoreBackup(
  backupData: BackupData,
  options: {
    conflictResolution: 'overwrite' | 'skip' | 'merge';
    createBackupBeforeRestore: boolean;
  },
  onProgress?: (progress: RestoreProgress) => void
): Promise<{ success: boolean; error?: string; restoredTables?: string[] }> {
  console.log('[BackupService] Starting restore operation...');
  console.log('[BackupService] Conflict resolution:', options.conflictResolution);
  console.log('[BackupService] Create backup before restore:', options.createBackupBeforeRestore);

  try {
    if (options.createBackupBeforeRestore) {
      console.log('[BackupService] Creating safety backup...');
      const tables = Object.keys(backupData.tables);
      const safetyBackup = await createBackup(
        `Pre-Restore Backup ${new Date().toLocaleString()}`,
        'Automatic backup created before restore operation',
        'selective',
        tables
      );

      if (!safetyBackup.success) {
        return {
          success: false,
          error: 'Failed to create safety backup before restore',
        };
      }
      console.log('[BackupService] Safety backup created:', safetyBackup.backupId);
    }

    const tablesToRestore = Object.keys(backupData.tables);
    const sortedTables = sortTablesByDependency(tablesToRestore);
    const restoredTables: string[] = [];

    console.log('[BackupService] Table restore order:', sortedTables);

    for (let i = 0; i < sortedTables.length; i++) {
      const tableName = sortedTables[i];
      const rows = backupData.tables[tableName];

      console.log(`[BackupService] Restoring table ${i + 1}/${sortedTables.length}: ${tableName} (${rows.length} rows)`);

      if (onProgress) {
        onProgress({
          table: tableName,
          processed: 0,
          total: rows.length,
          status: 'processing',
        });
      }

      try {
        if (options.conflictResolution === 'overwrite') {
          console.log(`[BackupService] Deleting existing data from ${tableName}...`);
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

          if (deleteError) {
            console.error(`[BackupService] Error deleting data from ${tableName}:`, deleteError);
          }
        }

        if (rows.length > 0) {
          const BATCH_SIZE = 100;
          for (let j = 0; j < rows.length; j += BATCH_SIZE) {
            const batch = rows.slice(j, Math.min(j + BATCH_SIZE, rows.length));
            console.log(`[BackupService] Inserting batch ${Math.floor(j / BATCH_SIZE) + 1} (${batch.length} rows) into ${tableName}`);

            const { error: insertError } = await supabase
              .from(tableName)
              .upsert(batch, { onConflict: 'id' });

            if (insertError) {
              console.error(`[BackupService] Error inserting batch into ${tableName}:`, insertError);

              if (onProgress) {
                onProgress({
                  table: tableName,
                  processed: j + batch.length,
                  total: rows.length,
                  status: 'failed',
                });
              }

              throw insertError;
            }

            if (onProgress) {
              onProgress({
                table: tableName,
                processed: Math.min(j + BATCH_SIZE, rows.length),
                total: rows.length,
                status: 'processing',
              });
            }
          }
        }

        if (onProgress) {
          onProgress({
            table: tableName,
            processed: rows.length,
            total: rows.length,
            status: 'completed',
          });
        }

        restoredTables.push(tableName);
        console.log(`[BackupService] Table ${tableName} restored successfully`);
      } catch (error: any) {
        console.error(`[BackupService] Error restoring table ${tableName}:`, error);

        if (onProgress) {
          onProgress({
            table: tableName,
            processed: 0,
            total: rows.length,
            status: 'failed',
          });
        }

        throw error;
      }
    }

    console.log('[BackupService] Restore completed successfully');
    return { success: true, restoredTables };
  } catch (error: any) {
    console.error('[BackupService] Restore failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to restore backup',
    };
  }
}

function sortTablesByDependency(tables: string[]): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();

  function visit(table: string) {
    if (visited.has(table)) return;
    visited.add(table);

    const dependencies = TABLE_DEPENDENCIES[table] || [];
    for (const dep of dependencies) {
      if (tables.includes(dep)) {
        visit(dep);
      }
    }

    sorted.push(table);
  }

  for (const table of tables) {
    visit(table);
  }

  return sorted;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
