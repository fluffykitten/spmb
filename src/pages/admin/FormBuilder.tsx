import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FormBuilder as FormBuilderComponent } from '../../components/admin/FormBuilder';
import { FormField, defaultFormSchema } from '../../lib/defaultFormSchema';
import { Save, Upload, Download, RotateCcw, Eye, Edit3, FileCode } from 'lucide-react';

export const FormBuilderPage: React.FC = () => {
  const [formSchema, setFormSchema] = useState<FormField[]>(defaultFormSchema);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    fetchFormSchema();
  }, []);

  const fetchFormSchema = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('form_schemas')
        .select('*')
        .eq('name', 'application_form')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data && data.fields) {
        setFormSchema(data.fields as FormField[]);
        setLastSaved(new Date(data.updated_at));
      }
    } catch (error) {
      console.error('Error fetching form schema:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchemaChange = (schema: FormField[]) => {
    setFormSchema(schema);
    setHasChanges(true);
  };

  const handleSave = async (schema: FormField[]) => {
    try {
      setSaving(true);

      const { data: existing } = await supabase
        .from('form_schemas')
        .select('id')
        .eq('name', 'application_form')
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('form_schemas')
          .update({
            fields: schema,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('form_schemas')
          .insert({
            name: 'application_form',
            fields: schema,
            is_active: true,
            version: 1
          });
      }

      setFormSchema(schema);
      setHasChanges(false);
      setLastSaved(new Date());
      alert('Form schema berhasil disimpan!');
    } catch (error) {
      console.error('Error saving form schema:', error);
      alert('Gagal menyimpan form schema: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(formSchema, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `form-schema-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const schema = JSON.parse(event.target?.result as string);
          if (Array.isArray(schema)) {
            setFormSchema(schema);
            setHasChanges(true);
            alert('Schema berhasil diimport!');
          } else {
            alert('Format file tidak valid!');
          }
        } catch (error) {
          alert('Gagal membaca file: ' + (error as Error).message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = async () => {
    if (!confirm('Reset ke default schema? Perubahan yang belum disimpan akan hilang.')) return;
    setFormSchema(defaultFormSchema);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Memuat form builder...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Form Builder</h2>
          <p className="text-slate-600 mt-1">
            Buat dan kelola form pendaftaran siswa secara visual
          </p>
          {lastSaved && (
            <p className="text-sm text-slate-500 mt-2">
              Terakhir disimpan: {lastSaved.toLocaleString('id-ID')}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={handleImport}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-900">
            <Edit3 className="h-5 w-5" />
            <span className="font-medium">Ada perubahan yang belum disimpan</span>
          </div>
          <button
            onClick={() => handleSave(formSchema)}
            disabled={saving}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Sekarang'}
          </button>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <FileCode className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Fitur Form Builder
            </h3>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                Drag and drop untuk mengatur urutan field
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                Tambahkan separator untuk memisah section (Data Diri, Data Orang Tua, dll)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                9 tipe field: Text, Email, Number, Phone, Textarea, Select, Radio, Date, Image Upload
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                Validasi otomatis untuk NISN, NIK, Nomor Telepon, Kode Pos
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                Export/Import schema untuk backup atau migrasi
              </li>
            </ul>
          </div>
        </div>
      </div>

      <FormBuilderComponent
        initialSchema={formSchema}
        onSave={handleSave}
      />

      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Menyimpan...</p>
          </div>
        </div>
      )}
    </div>
  );
};
