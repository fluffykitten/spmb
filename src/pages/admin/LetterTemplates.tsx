import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DataTable, Column } from '../../components/shared/DataTable';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { TemplateConfigWizard } from '../../components/admin/TemplateConfigWizard';
import { Plus, Edit2, Trash2, Copy, Eye } from 'lucide-react';

interface LetterTemplate {
  id: string;
  name: string;
  description: string | null;
  html_content: string;
  template_type: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

export const LetterTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; templateId: string | null }>({
    isOpen: false,
    templateId: null
  });
  const [editingTemplate, setEditingTemplate] = useState<LetterTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('letter_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleDuplicate = async (template: LetterTemplate) => {
    try {
      const { error } = await supabase
        .from('letter_templates')
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          html_content: template.html_content,
          template_type: template.template_type,
          variables: template.variables
        });

      if (error) throw error;
      await fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
    }
  };

  const columns: Column<LetterTemplate>[] = [
    {
      key: 'name',
      label: 'Nama Template',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-medium text-slate-800">{item.name}</div>
          {item.description && (
            <div className="text-xs text-slate-500 mt-1">{item.description}</div>
          )}
        </div>
      )
    },
    {
      key: 'template_type',
      label: 'Tipe',
      sortable: true,
      render: (item) => (
        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
          {item.template_type}
        </span>
      )
    },
    {
      key: 'variables',
      label: 'Variables',
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {(item.variables || []).slice(0, 3).map((variable, index) => (
            <span key={index} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">
              {variable}
            </span>
          ))}
          {(item.variables || []).length > 3 && (
            <span className="text-xs text-slate-500">+{(item.variables || []).length - 3} more</span>
          )}
        </div>
      )
    },
    {
      key: 'updated_at',
      label: 'Terakhir Diubah',
      sortable: true,
      render: (item) => new Date(item.updated_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingTemplate(item);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicate(item);
            }}
            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="Duplikat"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialog({ isOpen: true, templateId: item.id });
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Hapus"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Memuat data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Template Surat</h2>
          <p className="text-slate-600 mt-1">Kelola template surat untuk berbagai kebutuhan</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Buat Template Baru
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Available Variables</h3>
        <div className="flex flex-wrap gap-2">
          {['{{nama_lengkap}}', '{{nisn}}', '{{email}}', '{{status}}', '{{tanggal}}', '{{nomor_surat}}'].map(variable => (
            <span key={variable} className="px-2 py-1 bg-white border border-blue-200 text-blue-700 rounded text-xs font-mono">
              {variable}
            </span>
          ))}
        </div>
        <p className="text-xs text-blue-700 mt-2">
          Gunakan variable di atas dalam template HTML Anda. Variable akan otomatis diganti dengan data siswa saat generate surat.
        </p>
      </div>

      <DataTable
        data={templates}
        columns={columns}
        searchable={true}
        searchPlaceholder="Cari template..."
        emptyMessage="Belum ada template. Klik tombol 'Buat Template Baru' untuk memulai."
      />

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, templateId: null })}
        onConfirm={() => {
          if (deleteDialog.templateId) {
            handleDelete(deleteDialog.templateId);
          }
        }}
        title="Hapus Template"
        message="Apakah Anda yakin ingin menghapus template ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        variant="danger"
      />

      {(isCreating || editingTemplate) && (
        <TemplateConfigWizard
          template={editingTemplate}
          onClose={() => {
            setIsCreating(false);
            setEditingTemplate(null);
          }}
          onSave={async () => {
            await fetchTemplates();
            setIsCreating(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
};
