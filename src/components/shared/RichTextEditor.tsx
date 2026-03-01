import React, { useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Code,
  Image as ImageIcon,
  Undo,
  Redo,
  Minus,
  Table as TableIcon,
  Trash2,
  Plus,
  Type,
  Palette
} from 'lucide-react';
import { uploadExamImage } from '../../lib/examImageUpload';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  examId?: string;
  compact?: boolean;
}

const fontSizes = [
  { label: 'Kecil', value: '12px' },
  { label: 'Normal', value: '14px' },
  { label: 'Sedang', value: '16px' },
  { label: 'Besar', value: '18px' },
  { label: 'Sangat Besar', value: '24px' }
];

const colors = [
  { label: 'Hitam', value: '#000000' },
  { label: 'Abu-abu', value: '#6b7280' },
  { label: 'Merah', value: '#dc2626' },
  { label: 'Oranye', value: '#ea580c' },
  { label: 'Kuning', value: '#ca8a04' },
  { label: 'Hijau', value: '#16a34a' },
  { label: 'Biru', value: '#2563eb' },
  { label: 'Ungu', value: '#9333ea' }
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Tulis di sini...',
  minHeight = '120px',
  examId,
  compact = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = React.useState(false);
  const [showColorMenu, setShowColorMenu] = React.useState(false);
  const [showTableMenu, setShowTableMenu] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false
      }),
      Underline,
      TextAlign.configure({
        types: ['paragraph']
      }),
      Placeholder.configure({
        placeholder
      }),
      TextStyle,
      Color,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg'
        }
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-slate-300'
        }
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-slate-300 bg-slate-100 p-2 font-semibold'
        }
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-slate-300 p-2'
        }
      })
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none px-3 py-2`,
        style: `min-height: ${minHeight}`
      }
    }
  });

  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    console.log('[RichTextEditor] Image selected for upload:', file.name);
    setUploading(true);

    const result = await uploadExamImage(file, examId);

    if (result.success && result.url) {
      console.log('[RichTextEditor] Image uploaded, inserting into editor');
      editor.chain().focus().setImage({ src: result.url }).run();
    } else {
      console.error('[RichTextEditor] Image upload failed:', result.error);
      alert(result.error || 'Gagal mengunggah gambar');
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [editor, examId]);

  const insertTable = useCallback((rows: number, cols: number) => {
    if (!editor) return;
    console.log('[RichTextEditor] Inserting table:', rows, 'x', cols);
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setShowTableMenu(false);
  }, [editor]);

  if (!editor) return null;

  const ToolbarButton: React.FC<{
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }> = ({ onClick, active, disabled, title, children }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-slate-600 hover:bg-slate-100'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );

  const ToolbarDivider = () => (
    <div className="w-px h-6 bg-slate-200 mx-1" />
  );

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
      <div className="border-b border-slate-200 bg-slate-50 p-1.5 flex flex-wrap items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Tebal (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Miring (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Garis Bawah (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Coret"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        {!compact && (
          <>
            <ToolbarDivider />

            <div className="relative">
              <ToolbarButton
                onClick={() => {
                  setShowFontSizeMenu(!showFontSizeMenu);
                  setShowColorMenu(false);
                  setShowTableMenu(false);
                }}
                title="Ukuran Font"
              >
                <Type className="h-4 w-4" />
              </ToolbarButton>
              {showFontSizeMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                  {fontSizes.map((size) => (
                    <button
                      key={size.value}
                      type="button"
                      onClick={() => {
                        editor.chain().focus().setMark('textStyle', { fontSize: size.value }).run();
                        setShowFontSizeMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 transition-colors"
                      style={{ fontSize: size.value }}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <ToolbarButton
                onClick={() => {
                  setShowColorMenu(!showColorMenu);
                  setShowFontSizeMenu(false);
                  setShowTableMenu(false);
                }}
                title="Warna Teks"
              >
                <Palette className="h-4 w-4" />
              </ToolbarButton>
              {showColorMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-2 grid grid-cols-4 gap-1">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => {
                        editor.chain().focus().setColor(color.value).run();
                        setShowColorMenu(false);
                      }}
                      title={color.label}
                      className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color.value }}
                    />
                  ))}
                </div>
              )}
            </div>

            <ToolbarDivider />

            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              active={editor.isActive({ textAlign: 'left' })}
              title="Rata Kiri"
            >
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              active={editor.isActive({ textAlign: 'center' })}
              title="Rata Tengah"
            >
              <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              active={editor.isActive({ textAlign: 'right' })}
              title="Rata Kanan"
            >
              <AlignRight className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              title="Daftar Bullet"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              title="Daftar Bernomor"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive('blockquote')}
              title="Kutipan"
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              active={editor.isActive('codeBlock')}
              title="Blok Kode"
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Garis Horizontal"
            >
              <Minus className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <div className="relative">
              <ToolbarButton
                onClick={() => {
                  setShowTableMenu(!showTableMenu);
                  setShowFontSizeMenu(false);
                  setShowColorMenu(false);
                }}
                active={editor.isActive('table')}
                title="Tabel"
              >
                <TableIcon className="h-4 w-4" />
              </ToolbarButton>
              {showTableMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-2">
                  <p className="text-xs text-slate-500 mb-2 px-1">Sisipkan Tabel</p>
                  <div className="grid grid-cols-3 gap-1">
                    {[2, 3, 4].map((rows) => (
                      [2, 3, 4].map((cols) => (
                        <button
                          key={`${rows}-${cols}`}
                          type="button"
                          onClick={() => insertTable(rows, cols)}
                          className="px-2 py-1 text-xs bg-slate-100 hover:bg-blue-100 rounded transition-colors"
                        >
                          {rows}x{cols}
                        </button>
                      ))
                    ))}
                  </div>
                  {editor.isActive('table') && (
                    <>
                      <div className="border-t border-slate-200 mt-2 pt-2">
                        <p className="text-xs text-slate-500 mb-1 px-1">Edit Tabel</p>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => editor.chain().focus().addColumnAfter().run()}
                            className="flex-1 px-2 py-1 text-xs bg-slate-100 hover:bg-blue-100 rounded transition-colors flex items-center justify-center gap-1"
                            title="Tambah Kolom"
                          >
                            <Plus className="h-3 w-3" /> Kolom
                          </button>
                          <button
                            type="button"
                            onClick={() => editor.chain().focus().addRowAfter().run()}
                            className="flex-1 px-2 py-1 text-xs bg-slate-100 hover:bg-blue-100 rounded transition-colors flex items-center justify-center gap-1"
                            title="Tambah Baris"
                          >
                            <Plus className="h-3 w-3" /> Baris
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            editor.chain().focus().deleteTable().run();
                            setShowTableMenu(false);
                          }}
                          className="w-full mt-1 px-2 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded transition-colors flex items-center justify-center gap-1"
                          title="Hapus Tabel"
                        >
                          <Trash2 className="h-3 w-3" /> Hapus Tabel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Sisipkan Gambar"
        >
          {uploading ? (
            <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />

        {!compact && (
          <>
            <ToolbarDivider />

            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="h-4 w-4" />
            </ToolbarButton>
          </>
        )}
      </div>

      <div onClick={() => editor.chain().focus().run()} className="cursor-text">
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror {
          min-height: ${minHeight};
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror table {
          border-collapse: collapse;
          margin: 0.5rem 0;
          width: 100%;
        }
        .ProseMirror th,
        .ProseMirror td {
          border: 1px solid #cbd5e1;
          padding: 0.5rem;
          text-align: left;
        }
        .ProseMirror th {
          background-color: #f1f5f9;
          font-weight: 600;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #cbd5e1;
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: #64748b;
        }
        .ProseMirror pre {
          background-color: #1e293b;
          color: #e2e8f0;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          font-family: monospace;
          font-size: 0.875rem;
          overflow-x: auto;
        }
        .ProseMirror hr {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 1rem 0;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror li {
          margin: 0.25rem 0;
        }
        .ProseMirror strong {
          font-weight: 600;
        }
        .ProseMirror em {
          font-style: italic;
        }
        .ProseMirror u {
          text-decoration: underline;
        }
        .ProseMirror s {
          text-decoration: line-through;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
