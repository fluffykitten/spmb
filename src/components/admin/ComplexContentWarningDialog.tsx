import React from 'react';
import { AlertTriangle, Table, Image, Box, FileText, CheckCircle, XCircle } from 'lucide-react';
import { ComplexElement } from '../../lib/wordTemplateParser';

interface ComplexContentWarningDialogProps {
  isOpen: boolean;
  complexElements: ComplexElement[];
  onContinue: () => void;
  onCancel: () => void;
}

const getIcon = (type: ComplexElement['type']) => {
  switch (type) {
    case 'table':
      return <Table className="h-5 w-5 text-blue-600" />;
    case 'image':
      return <Image className="h-5 w-5 text-purple-600" />;
    case 'shape':
      return <Box className="h-5 w-5 text-orange-600" />;
    case 'textbox':
      return <FileText className="h-5 w-5 text-emerald-600" />;
    default:
      return <AlertTriangle className="h-5 w-5 text-amber-600" />;
  }
};

export const ComplexContentWarningDialog: React.FC<ComplexContentWarningDialogProps> = ({
  isOpen,
  complexElements,
  onContinue,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-amber-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-amber-900">
                PERINGATAN: Konten Kompleks Terdeteksi
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Dokumen Word Anda mengandung elemen kompleks yang mungkin tidak terkonversi sempurna
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Elemen yang Terdeteksi:
              </h4>
              <div className="space-y-2">
                {complexElements.map((element, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 bg-white p-3 rounded-lg border border-blue-100"
                  >
                    {getIcon(element.type)}
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">{element.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-3">Catatan Konversi:</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Tabel:</strong> Akan dikonversi ke HTML table standar</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Gambar:</strong> Akan di-embed sebagai base64 (ukuran file bisa membesar)</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Shape/Drawing:</strong> Mungkin tidak terkonversi sempurna atau hilang</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Text Box:</strong> Akan dikonversi ke paragraf biasa</span>
                </li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Rekomendasi:</strong> Jika hasil konversi tidak sesuai harapan, Anda dapat membatalkan
                dan mengupload ulang dokumen yang lebih sederhana, atau mengedit HTML secara manual setelah konversi.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-between gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Batal & Upload Ulang
          </button>
          <button
            onClick={onContinue}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <CheckCircle className="h-5 w-5" />
            Lanjutkan Konversi
          </button>
        </div>
      </div>
    </div>
  );
};
