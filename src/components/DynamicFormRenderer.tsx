import React, { useState } from 'react';
import { FormField } from '../lib/defaultFormSchema';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { ImageUploadField } from './shared/ImageUploadField';
import { useAuth } from '../contexts/AuthContext';

interface DynamicFormRendererProps {
  schema: FormField[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  onChange: (name: string, value: any) => void;
}

export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
  schema,
  formData,
  errors,
  onChange,
}) => {
  const { user } = useAuth();
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = (fieldName: string) => {
    setTouched({ ...touched, [fieldName]: true });
  };

  const getFieldState = (field: FormField): 'valid' | 'invalid' | 'untouched' => {
    const value = formData[field.name];
    const hasError = errors[field.name];
    const isTouched = touched[field.name];

    if (!isTouched && !value) return 'untouched';
    if (hasError) return 'invalid';
    if (value && field.required) return 'valid';
    return 'untouched';
  };

  const getCharacterCount = (field: FormField): string | null => {
    const value = formData[field.name] || '';
    if (field.validation?.maxLength) {
      return `${value.length}/${field.validation.maxLength}`;
    }
    return null;
  };

  const getFieldHint = (field: FormField): string | null => {
    if (field.name === 'phone_number' || field.name === 'telepon') {
      return 'Format: 08xx atau 628xx atau +628xx';
    }
    if (field.name === 'nisn') {
      return '10 digit angka';
    }
    if (field.name === 'nik') {
      return '16 digit angka';
    }
    if (field.name === 'kode_pos') {
      return '5 digit angka';
    }
    return null;
  };

  const renderField = (field: FormField) => {
    if (field.type === 'separator') {
      return null;
    }

    const value = formData[field.name] || '';
    const error = errors[field.name];
    const fieldState = getFieldState(field);
    const charCount = getCharacterCount(field);
    const hint = getFieldHint(field);

    const baseInputClasses = `w-full px-4 py-3 pr-10 border rounded-lg focus:ring-2 outline-none transition-all ${
      error
        ? 'border-red-500 focus:ring-red-200 focus:border-red-500'
        : fieldState === 'valid'
        ? 'border-emerald-500 focus:ring-emerald-200 focus:border-emerald-500'
        : 'border-slate-300 focus:ring-blue-500 focus:border-transparent'
    }`;

    const commonProps = {
      id: field.name,
      name: field.name,
      value: value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        onChange(field.name, e.target.value),
      onBlur: () => handleBlur(field.name),
      placeholder: field.placeholder,
      required: field.required,
      className: baseInputClasses
    };

    const renderInputWithIcon = (input: React.ReactNode) => (
      <div className="relative">
        {input}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {fieldState === 'valid' && (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          )}
          {fieldState === 'invalid' && (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
        </div>
        {charCount && (
          <div className="absolute right-3 top-full mt-1 text-xs text-slate-500">
            {charCount}
          </div>
        )}
      </div>
    );

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'date':
        return renderInputWithIcon(
          <input
            {...commonProps}
            type={field.type}
            minLength={field.validation?.minLength}
            maxLength={field.validation?.maxLength}
            pattern={field.validation?.pattern}
          />
        );

      case 'number':
        return renderInputWithIcon(
          <input
            {...commonProps}
            type="number"
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );

      case 'textarea':
        return (
          <div className="relative">
            <textarea
              {...commonProps}
              rows={4}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
            />
            {charCount && (
              <div className="absolute right-3 bottom-3 text-xs text-slate-500">
                {charCount}
              </div>
            )}
          </div>
        );

      case 'select':
        return (
          <select
            id={field.name}
            name={field.name}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            required={field.required}
            className={baseInputClasses}
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 p-3 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name={field.name}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  required={field.required}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'image':
        return user ? (
          <ImageUploadField
            field={field}
            value={value}
            onChange={(url) => onChange(field.name, url)}
            userId={user.id}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {schema.map((field, index) => {
          if (field.type === 'separator') {
            return (
              <div key={field.name} className="md:col-span-2 -mx-6 px-6 py-4 bg-gradient-to-r from-blue-50 to-slate-50 border-y border-slate-200 mt-6 first:mt-0 mb-2">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-blue-600"></div>
                  {field.label}
                </h3>
              </div>
            );
          }

          return (
            <div
              key={field.name}
              className={field.type === 'textarea' || field.type === 'radio' || field.type === 'image' ? 'md:col-span-2' : ''}
            >
              <label htmlFor={field.name} className="block text-sm font-medium text-slate-700 mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderField(field)}
              {errors[field.name] && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors[field.name]}
                </p>
              )}
              {!errors[field.name] && getFieldHint(field) && (
                <p className="mt-2 text-sm text-slate-500 flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  {getFieldHint(field)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
