import React, { useState } from 'react';
import { Edit2, Trash2, Plus, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { DetectedVariable, validateVariableName } from '../../lib/wordTemplateParser';

interface VariableConfirmationStepProps {
  variables: DetectedVariable[];
  htmlContent: string;
  onVariablesChange: (variables: DetectedVariable[]) => void;
}

export const VariableConfirmationStep: React.FC<VariableConfirmationStepProps> = ({
  variables,
  htmlContent,
  onVariablesChange
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [newVariableName, setNewVariableName] = useState('');

  const handleEditStart = (index: number) => {
    setEditingIndex(index);
    setEditValue(variables[index].normalized);
  };

  const handleEditSave = (index: number) => {
    const normalized = editValue.trim().toUpperCase();

    if (!validateVariableName(normalized)) {
      alert('Nama variabel tidak valid! Gunakan huruf besar, angka, dan underscore.');
      return;
    }

    const isDuplicate = variables.some(
      (v, i) => i !== index && v.normalized === normalized
    );

    if (isDuplicate) {
      alert('Nama variabel sudah ada!');
      return;
    }

    const updated = [...variables];
    updated[index] = { ...updated[index], normalized };
    onVariablesChange(updated);
    setEditingIndex(null);
    setEditValue('');
  };

  const handleDelete = (index: number) => {
    if (confirm('Hapus variabel ini?')) {
      const updated = variables.filter((_, i) => i !== index);
      onVariablesChange(updated);
    }
  };

  const handleAddVariable = () => {
    const normalized = newVariableName.trim().toUpperCase();

    if (!normalized) {
      alert('Masukkan nama variabel!');
      return;
    }

    if (!validateVariableName(normalized)) {
      alert('Nama variabel tidak valid! Gunakan huruf besar, angka, dan underscore.');
      return;
    }

    const isDuplicate = variables.some(v => v.normalized === normalized);
    if (isDuplicate) {
      alert('Nama variabel sudah ada!');
      return;
    }

    const newVariable: DetectedVariable = {
      original: normalized,
      normalized,
      format: 'double_curly',
      occurrences: 0
    };

    onVariablesChange([...variables, newVariable]);
    setNewVariableName('');
  };

  const getPreviewHTML = () => {
    let preview = htmlContent;
    variables.forEach((variable, index) => {
      const colors = [
        'bg-blue-100 text-blue-800 border-blue-300',
        'bg-purple-100 text-purple-800 border-purple-300',
        'bg-emerald-100 text-emerald-800 border-emerald-300',
        'bg-orange-100 text-orange-800 border-orange-300',
        'bg-pink-100 text-pink-800 border-pink-300',
      ];
      const color = colors[index % colors.length];

      const pattern = new RegExp(`\\{\\{${variable.normalized}\\}\\}`, 'g');
      preview = preview.replace(
        pattern,
        `<span class="px-2 py-0.5 rounded border ${color} font-mono text-xs font-semibold">{{${variable.normalized}}}</span>`
      );
    });
    return preview;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-slate-800 text-lg">Konfirmasi Variabel Template</h4>
          <p className="text-sm text-slate-600 mt-1">
            {variables.length} variabel terdeteksi. Review dan edit jika diperlukan.
          </p>
        </div>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          {showPreview ? (
            <>
              <EyeOff className="h-4 w-4" />
              Sembunyikan Preview
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Tampilkan Preview
            </>
          )}
        </button>
      </div>

      {variables.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900">Tidak ada variabel terdeteksi</p>
            <p className="text-xs text-amber-700 mt-1">
              Tambahkan variabel secara manual menggunakan form di bawah ini.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        {variables.map((variable, index) => (
          <div
            key={index}
            className="bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                {editingIndex === index ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(index);
                      if (e.key === 'Escape') {
                        setEditingIndex(null);
                        setEditValue('');
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-blue-400 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                ) : (
                  <div className="font-mono text-sm font-semibold text-slate-800">
                    {'{{'}
                    {variable.normalized}
                    {'}}'}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 ml-2">
                {editingIndex === index ? (
                  <>
                    <button
                      onClick={() => handleEditSave(index)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                      title="Simpan"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingIndex(null);
                        setEditValue('');
                      }}
                      className="p-1.5 text-slate-600 hover:bg-slate-50 rounded transition-colors"
                      title="Batal"
                    >
                      <AlertCircle className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEditStart(index)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Original:</span>
                <span className="font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded">
                  {variable.original}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Format:</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                  {variable.format === 'double_curly' && '{{ }}'}
                  {variable.format === 'single_curly' && '{ }'}
                  {variable.format === 'square' && '[ ]'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Muncul:</span>
                <span className="text-slate-700 font-medium">
                  {variable.occurrences}x
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h5 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Tambah Variabel Manual
        </h5>
        <div className="flex gap-2">
          <input
            type="text"
            value={newVariableName}
            onChange={(e) => setNewVariableName(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddVariable();
            }}
            placeholder="NAMA_VARIABEL"
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
          />
          <button
            onClick={handleAddVariable}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Format: Huruf besar, angka, dan underscore (contoh: NAMA_LENGKAP, NISN, NO_HP)
        </p>
      </div>

      {showPreview && (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-6">
          <h5 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-600" />
            Preview Template dengan Highlight Variabel
          </h5>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: getPreviewHTML() }}
          />
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Catatan:</strong> Semua variabel telah dinormalisasi ke format HURUF_BESAR dengan
          underscore. Variabel akan otomatis diganti dengan data siswa saat generate surat.
        </p>
      </div>
    </div>
  );
};
