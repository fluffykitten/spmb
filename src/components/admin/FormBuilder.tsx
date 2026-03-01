import React, { useState } from 'react';
import { Plus, Trash2, Edit2, GripVertical, Eye, Save, Image, Minus } from 'lucide-react';
import { FormField } from '../../lib/defaultFormSchema';

interface FormBuilderProps {
  initialSchema?: FormField[];
  onSave: (schema: FormField[]) => void;
}

const fieldTypes = [
  { value: 'separator', label: 'Separator (Pemisah Section)' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'tel', label: 'Phone' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Select' },
  { value: 'radio', label: 'Radio' },
  { value: 'date', label: 'Date' },
  { value: 'image', label: 'Image Upload' }
];

export const FormBuilder: React.FC<FormBuilderProps> = ({ initialSchema = [], onSave }) => {
  const [fields, setFields] = useState<FormField[]>(initialSchema);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addField = (type: string = 'text') => {
    const newField: FormField = type === 'separator'
      ? {
          name: `separator_${Date.now()}`,
          label: 'Pemisah Section',
          type: 'separator' as any,
          required: false
        }
      : {
          name: `field_${Date.now()}`,
          label: 'New Field',
          type: 'text',
          required: false
        };
    const newFields = [...fields, newField];
    setFields(newFields);
    setEditingField(newField);
    setEditingIndex(newFields.length - 1);
  };

  const deleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (updatedField: FormField) => {
    if (editingIndex !== null) {
      const newFields = [...fields];
      newFields[editingIndex] = updatedField;
      setFields(newFields);
    }
    setEditingField(null);
    setEditingIndex(null);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFields = [...fields];
    const draggedField = newFields[draggedIndex];
    newFields.splice(draggedIndex, 1);
    newFields.splice(index, 0, draggedField);

    setFields(newFields);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Form Fields</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            <button
              onClick={() => onSave(fields)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Form
            </button>
          </div>
        </div>

        {showPreview ? (
          <FormPreview fields={fields} />
        ) : (
          <div className="space-y-3">
            {fields.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
                <p className="text-slate-600 mb-4">No fields yet. Click the button below to add your first field.</p>
                <button
                  onClick={addField}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add First Field
                </button>
              </div>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.name}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white border rounded-lg p-4 flex items-center gap-3 cursor-move hover:border-blue-400 transition-colors ${
                    draggedIndex === index ? 'opacity-50' : ''
                  } ${field.type === 'separator' ? 'border-slate-300 bg-gradient-to-r from-blue-50 to-slate-50' : 'border-slate-200'}`}
                >
                  <GripVertical className="h-5 w-5 text-slate-400" />
                  {field.type === 'separator' && (
                    <Minus className="h-5 w-5 text-blue-600" />
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${field.type === 'separator' ? 'text-blue-800' : 'text-slate-800'}`}>
                      {field.label}
                      {field.type === 'separator' && <span className="ml-2 text-xs text-blue-600">(Pemisah)</span>}
                    </div>
                    {field.type !== 'separator' && (
                      <div className="text-sm text-slate-500">
                        {field.name} • {field.type} {field.required && '• Required'}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setEditingField(field);
                      setEditingIndex(index);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteField(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}

            {fields.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => addField('text')}
                  className="py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Field
                </button>
                <button
                  onClick={() => addField('separator')}
                  className="py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Minus className="h-5 w-5" />
                  Add Separator
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <div className="sticky top-4">
          {editingField ? (
            <FieldEditor
              field={editingField}
              onSave={updateField}
              onCancel={() => {
                setEditingField(null);
                setEditingIndex(null);
              }}
            />
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
              <p className="text-slate-600">Select a field to edit its properties</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface FieldEditorProps {
  field: FormField;
  onSave: (field: FormField) => void;
  onCancel: () => void;
}

const FieldEditor: React.FC<FieldEditorProps> = ({ field, onSave, onCancel }) => {
  const [editedField, setEditedField] = useState<FormField>({ ...field });

  const handleSave = () => {
    if (editedField.type === 'separator') {
      if (!editedField.label) {
        alert('Label is required for separator');
        return;
      }
      onSave({
        ...editedField,
        name: editedField.name || `separator_${Date.now()}`,
        required: false
      });
      return;
    }

    if (!editedField.name || !editedField.label) {
      alert('Name and Label are required');
      return;
    }
    onSave(editedField);
  };

  const addOption = () => {
    const options = editedField.options || [];
    setEditedField({
      ...editedField,
      options: [...options, { value: '', label: '' }]
    });
  };

  const updateOption = (index: number, key: 'value' | 'label', value: string) => {
    const options = [...(editedField.options || [])];
    options[index] = { ...options[index], [key]: value };
    setEditedField({ ...editedField, options });
  };

  const deleteOption = (index: number) => {
    const options = (editedField.options || []).filter((_, i) => i !== index);
    setEditedField({ ...editedField, options });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
      <h4 className="font-semibold text-slate-800">Edit Field</h4>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
        <select
          value={editedField.type}
          onChange={(e) => setEditedField({ ...editedField, type: e.target.value as any })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        >
          {fieldTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {editedField.type === 'separator' ? (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Judul Pemisah</label>
            <input
              type="text"
              value={editedField.label}
              onChange={(e) => setEditedField({ ...editedField, label: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="Contoh: Data Diri, Data Orang Tua, dll"
            />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              Separator berfungsi sebagai pemisah visual antar section di formulir.
              Tidak menyimpan data, hanya sebagai header pembatas.
            </p>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Field Name (Key)</label>
            <input
              type="text"
              value={editedField.name}
              onChange={(e) => setEditedField({ ...editedField, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="field_name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Label</label>
            <input
              type="text"
              value={editedField.label}
              onChange={(e) => setEditedField({ ...editedField, label: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="Field Label"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Placeholder</label>
            <input
              type="text"
              value={editedField.placeholder || ''}
              onChange={(e) => setEditedField({ ...editedField, placeholder: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="Placeholder text..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={editedField.required}
              onChange={(e) => setEditedField({ ...editedField, required: e.target.checked })}
              className="h-4 w-4 text-blue-600 border-slate-300 rounded"
            />
            <label htmlFor="required" className="text-sm font-medium text-slate-700">Required Field</label>
          </div>
        </>
      )}

      {(editedField.type === 'select' || editedField.type === 'radio') && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Options</label>
          <div className="space-y-2">
            {(editedField.options || []).map((option, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={option.value}
                  onChange={(e) => updateOption(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(index, 'label', e.target.value)}
                  placeholder="Label"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                <button
                  onClick={() => deleteOption(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addOption}
              className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600"
            >
              + Add Option
            </button>
          </div>
        </div>
      )}

      {editedField.type === 'image' && (
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm font-medium text-slate-700">Image Configuration</p>

          <div>
            <label className="block text-sm text-slate-600 mb-2">Max File Size (MB)</label>
            <input
              type="number"
              value={editedField.imageConfig?.maxSizeMB || 5}
              onChange={(e) => setEditedField({
                ...editedField,
                imageConfig: {
                  ...editedField.imageConfig,
                  maxSizeMB: parseInt(e.target.value) || 5
                }
              })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              min="1"
              max="10"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-2">Accepted Formats</label>
            <div className="space-y-2">
              {['image/jpeg', 'image/png', 'image/webp'].map(format => (
                <label key={format} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(editedField.imageConfig?.acceptedFormats || ['image/jpeg', 'image/png']).includes(format)}
                    onChange={(e) => {
                      const currentFormats = editedField.imageConfig?.acceptedFormats || ['image/jpeg', 'image/png'];
                      const newFormats = e.target.checked
                        ? [...currentFormats, format]
                        : currentFormats.filter(f => f !== format);
                      setEditedField({
                        ...editedField,
                        imageConfig: {
                          ...editedField.imageConfig,
                          acceptedFormats: newFormats
                        }
                      });
                    }}
                    className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                  />
                  <span className="text-sm text-slate-700">{format.split('/')[1].toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-2">Max Width (px)</label>
              <input
                type="number"
                value={editedField.imageConfig?.maxWidth || ''}
                onChange={(e) => setEditedField({
                  ...editedField,
                  imageConfig: {
                    ...editedField.imageConfig,
                    maxWidth: parseInt(e.target.value) || undefined
                  }
                })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Max Height (px)</label>
              <input
                type="number"
                value={editedField.imageConfig?.maxHeight || ''}
                onChange={(e) => setEditedField({
                  ...editedField,
                  imageConfig: {
                    ...editedField.imageConfig,
                    maxHeight: parseInt(e.target.value) || undefined
                  }
                })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              Rekomendasi: Untuk foto profil gunakan ukuran maksimal 2MB, format JPG/PNG. Untuk dokumen scan gunakan ukuran maksimal 5MB.
            </p>
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-slate-200 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
};

interface FormPreviewProps {
  fields: FormField[];
}

const FormPreview: React.FC<FormPreviewProps> = ({ fields }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">Form Preview</h3>
      <div className="space-y-6">
        {fields.map((field) => (
          <div key={field.name}>
            {field.type === 'separator' ? (
              <div className="border-b-2 border-slate-300 pb-2 mb-4">
                <h4 className="text-lg font-bold text-slate-800">{field.label}</h4>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-600 ml-1">*</span>}
                </label>

                {field.type === 'textarea' ? (
              <textarea
                placeholder={field.placeholder}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows={4}
                disabled
              />
            ) : field.type === 'select' ? (
              <select
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                disabled
              >
                <option value="">Select...</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'radio' ? (
              <div className="space-y-2">
                {field.options?.map((option) => (
                  <label key={option.value} className="flex items-center gap-2">
                    <input type="radio" name={field.name} value={option.value} disabled className="h-4 w-4" />
                    <span className="text-sm text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            ) : field.type === 'image' ? (
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                <Image className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 mb-1">Upload Image</p>
                <p className="text-xs text-slate-500">
                  {field.imageConfig?.acceptedFormats?.map(f => f.split('/')[1].toUpperCase()).join(', ') || 'JPG, PNG'} •
                  Max {field.imageConfig?.maxSizeMB || 5}MB
                  {(field.imageConfig?.maxWidth || field.imageConfig?.maxHeight) && (
                    <> • Max {field.imageConfig?.maxWidth || '∞'}x{field.imageConfig?.maxHeight || '∞'}px</>
                  )}
                </p>
              </div>
            ) : (
              <input
                type={field.type}
                placeholder={field.placeholder}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                disabled
              />
            )}
              </>
            )}
          </div>
        ))}

        {fields.length === 0 && (
          <p className="text-center text-slate-500 py-8">No fields to preview</p>
        )}
      </div>
    </div>
  );
};
