import React from 'react';
import {
  DocxLayoutConfig,
  PAGE_SIZES,
  FONT_FAMILIES,
  LINE_SPACINGS,
  TEXT_ALIGNMENTS
} from '../../lib/layoutConstants';

interface DocumentLayoutConfiguratorProps {
  layoutConfig: DocxLayoutConfig;
  onChange: (config: DocxLayoutConfig) => void;
}

export const DocumentLayoutConfigurator: React.FC<DocumentLayoutConfiguratorProps> = ({
  layoutConfig,
  onChange
}) => {
  const updateConfig = (updates: Partial<DocxLayoutConfig>) => {
    onChange({ ...layoutConfig, ...updates });
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm">
            1
          </span>
          Ukuran & Orientasi Halaman
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ukuran Kertas
            </label>
            <select
              value={layoutConfig.page_size}
              onChange={(e) => updateConfig({ page_size: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.keys(PAGE_SIZES).map((size) => (
                <option key={size} value={size}>
                  {size} ({PAGE_SIZES[size].width} × {PAGE_SIZES[size].height} cm)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Orientasi
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="portrait"
                  checked={layoutConfig.orientation === 'portrait'}
                  onChange={(e) => updateConfig({ orientation: e.target.value as 'portrait' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Portrait</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="landscape"
                  checked={layoutConfig.orientation === 'landscape'}
                  onChange={(e) => updateConfig({ orientation: e.target.value as 'landscape' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Landscape</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm">
            2
          </span>
          Margin Halaman (cm)
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Atas
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={layoutConfig.margin_top}
              onChange={(e) => updateConfig({ margin_top: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bawah
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={layoutConfig.margin_bottom}
              onChange={(e) => updateConfig({ margin_bottom: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kiri
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={layoutConfig.margin_left}
              onChange={(e) => updateConfig({ margin_left: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kanan
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={layoutConfig.margin_right}
              onChange={(e) => updateConfig({ margin_right: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Header Margin
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={layoutConfig.header_margin}
              onChange={(e) => updateConfig({ header_margin: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Footer Margin
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={layoutConfig.footer_margin}
              onChange={(e) => updateConfig({ footer_margin: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gutter
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={layoutConfig.gutter}
              onChange={(e) => updateConfig({ gutter: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm">
            3
          </span>
          Tipografi
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Font Family
            </label>
            <select
              value={layoutConfig.font_family}
              onChange={(e) => updateConfig({ font_family: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ukuran Font Body (pt)
            </label>
            <input
              type="number"
              min="8"
              max="24"
              value={layoutConfig.body_font_size}
              onChange={(e) => updateConfig({ body_font_size: parseInt(e.target.value) || 12 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ukuran Font Heading (pt)
            </label>
            <input
              type="number"
              min="10"
              max="32"
              value={layoutConfig.heading_font_size}
              onChange={(e) => updateConfig({ heading_font_size: parseInt(e.target.value) || 14 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Line Spacing
            </label>
            <select
              value={layoutConfig.line_spacing}
              onChange={(e) => updateConfig({ line_spacing: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {LINE_SPACINGS.map((spacing) => (
                <option key={spacing.value} value={spacing.value}>
                  {spacing.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm">
            4
          </span>
          Format Paragraf
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text Align
            </label>
            <select
              value={layoutConfig.text_align}
              onChange={(e) => updateConfig({ text_align: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {TEXT_ALIGNMENTS.map((align) => (
                <option key={align.value} value={align.value}>
                  {align.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Spacing Before (pt)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={layoutConfig.paragraph_spacing_before}
              onChange={(e) => updateConfig({ paragraph_spacing_before: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Spacing After (pt)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={layoutConfig.paragraph_spacing_after}
              onChange={(e) => updateConfig({ paragraph_spacing_after: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Line Indent (cm)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={layoutConfig.first_line_indent}
              onChange={(e) => updateConfig({ first_line_indent: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Indentasi baris pertama paragraf (0 = tidak ada indent)
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-medium">Catatan:</span> Semua pengaturan layout akan di-enforce saat dokumen digenerate.
          Pastikan konfigurasi sesuai dengan template DOCX yang akan diupload.
        </p>
      </div>
    </div>
  );
};
