import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DataTable, Column } from '../../components/shared/DataTable';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { DocxTemplateWizard } from '../../components/admin/DocxTemplateWizard';
import { Plus, Edit2, Trash2, FileText, Eye, Settings } from 'lucide-react';
import { LetterheadManager } from '../../components/admin/LetterheadManager';

interface DocxTemplate {
  id: string;
  name: string;
  description: string | null;
  template_format: string;
  template_type: string;
  docx_variables: string[];
  access_rule: string;
  required_status: string[];
  is_self_service: boolean;
  generation_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const DocxTemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<DocxTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; templateId: string | null }>({
    isOpen: false,
    templateId: null
  });
  const [editingTemplate, setEditingTemplate] = useState<DocxTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showLetterheadConfig, setShowLetterheadConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'templates' | 'letterhead'>('templates');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('template_format', 'docx')
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
      setDeleteDialog({ isOpen: false, templateId: null });
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const toggleActive = async (templateId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('letter_templates')
        .update({ is_active: !currentStatus })
        .eq('id', templateId);

      if (error) throw error;
      await fetchTemplates();
    } catch (error) {
      console.error('Error toggling template status:', error);
    }
  };

  const columns: Column<DocxTemplate>[] = [
    {
      key: 'name',
      label: 'Nama Template',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-800">{item.name}</div>
          {item.description && (
            <div className="text-xs text-gray-500 mt-1">{item.description}</div>
          )}
        </div>
      )
    },
    {
      key: 'template_type',
      label: 'Tipe',
      sortable: true,
      render: (item) => (
        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
          {item.template_type}
        </span>
      )
    },
    {
      key: 'access_rule',
      label: 'Akses',
      render: (item) => (
        <div className="text-xs">
          <div className="font-medium text-gray-700 capitalize">{item.access_rule}</div>
          {item.access_rule === 'status_based' && (
            <div className="text-gray-500 mt-0.5">
              {item.required_status.join(', ')}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'generation_limit',
      label: 'Limit',
      sortable: true,
      render: (item) => (
        <span className="text-sm text-gray-700">{item.generation_limit}x</span>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleActive(item.id, item.is_active);
          }}
          className={`px-2 py-1 rounded text-xs font-medium ${
            item.is_active
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {item.is_active ? 'Aktif' : 'Nonaktif'}
        </button>
      )
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
        <div className="text-gray-600">Memuat data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Template DOCX Self-Service</h2>
          <p className="text-gray-600 mt-1">Kelola template dokumen untuk siswa</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Buat Template Baru
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'templates'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Template ({templates.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('letterhead')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'letterhead'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Konfigurasi Kop Surat
          </div>
        </button>
      </div>

      {activeTab === 'templates' ? (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Sistem Self-Service</h3>
            <p className="text-xs text-blue-700">
              Template DOCX memungkinkan siswa men-generate dokumen mereka sendiri secara otomatis.
              Data siswa akan otomatis mengisi variabel yang ada di template. Setiap template memiliki
              limit generate (default 3x per siswa) untuk mencegah penyalahgunaan.
            </p>
          </div>

          <DataTable
            data={templates}
            columns={columns}
            searchable={true}
            searchPlaceholder="Cari template..."
            emptyMessage="Belum ada template DOCX. Klik tombol 'Buat Template Baru' untuk memulai."
          />
        </>
      ) : (
        <LetterheadManager />
      )}

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
        <DocxTemplateWizard
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
