import React, { useState, useEffect } from 'react';
import { HelpCircle, Copy, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface VariableGroup {
    id: string;
    name: string;
    description: string;
    variables: {
        key: string;
        description: string;
        example: string;
    }[];
}

const VARIABLE_DICTIONARY: VariableGroup[] = [
    {
        id: 'general',
        name: 'Data Umum Siswa',
        description: 'Variabel dasar yang berlaku untuk semua jenis notifikasi dan surat pendaftaran.',
        variables: [
            { key: '{{nama_lengkap}}', description: 'Nama Lengkap calon siswa', example: 'Budi Santoso' },
            { key: '{{registration_number}}', description: 'Nomor Registrasi pendaftaran siswa', example: '2526-0001' },
            { key: '{{email}}', description: 'Email yang didaftarkan siswa', example: 'budi@example.com' },
        ]
    },
    {
        id: 'payment',
        name: 'Pembayaran',
        description: 'Variabel yang muncul saat ada perubahan status pembayaran pendaftaran.',
        variables: [
            { key: '{{amount}}', description: 'Nominal pembayaran yang ditagihkan/dibayarkan', example: 'Rp 250.000' },
            { key: '{{status}}', description: 'Status pembayaran (cth: Lunas, Belum Lunas)', example: 'Lunas' },
        ]
    },
    {
        id: 'interview',
        name: 'Jadwal Wawancara',
        description: 'Variabel khusus untuk template penetapan jadwal wawancara.',
        variables: [
            { key: '{{interview_date}}', description: 'Tanggal wawancara dilaksanakan', example: 'Senin, 10 Agustus 2026' },
            { key: '{{interview_time}}', description: 'Jam mulai hingga selesai', example: '08:00 - 08:30' },
            { key: '{{interview_type}}', description: 'Tipe wawancara (Online / Offline)', example: 'Online' },
            { key: '{{meeting_link}}', description: 'URL Google Meet/Zoom ATAU Alamat Sekolah', example: 'https://meet.google.com/abc-xyz Atau Jl. Merdeka No.1' },
            { key: '{{admin_notes}}', description: 'Catatan tambahan dari admin', example: 'Pastikan sinyal internet stabil' },
        ]
    },
    {
        id: 'interviewer',
        name: 'Penugasan Pewawancara',
        description: 'Digunakan khusus dalam email ke pewawancara internal sekolah.',
        variables: [
            { key: '{{interviewer_name}}', description: 'Nama Pewawancara/Guru', example: 'Pak Ahmad, S.Pd' },
            { key: '{{student_name}}', description: 'Nama Siswa (Alternatif dari nama_lengkap)', example: 'Budi Santoso' },
        ]
    },
    {
        id: 'admin',
        name: 'Catatan Admin',
        description: 'Digunakan saat pendaftaran perlu direvisi.',
        variables: [
            { key: '{{admin_comments}}', description: 'Catatan instruksi perbaikan dari panitia', example: 'Pas foto kurang jelas, tolong upload foto terbaru dengan latar belakang merah.' }
        ]
    }
];

interface VariableCheatSheetProps {
    buttonText?: string;
    className?: string;
}

export const VariableCheatSheet: React.FC<VariableCheatSheetProps> = ({
    buttonText = 'Panduan Variabel',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['general']);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [customGroup, setCustomGroup] = useState<VariableGroup | null>(null);
    const [loadingCustom, setLoadingCustom] = useState(false);

    useEffect(() => {
        if (isOpen && !customGroup && !loadingCustom) {
            fetchCustomFields();
        }
    }, [isOpen]);

    const fetchCustomFields = async () => {
        try {
            setLoadingCustom(true);
            const { data, error } = await supabase
                .from('form_schemas')
                .select('*')
                .eq('name', 'application_form')
                .eq('is_active', true)
                .maybeSingle();

            if (error) {
                console.error('VariableCheatSheet: Supabase query error', error);
                throw error;
            }

            console.log('VariableCheatSheet: fetched fields data', data);

            if (data && data.fields) {
                let rawFields = data.fields;
                if (typeof rawFields === 'string') {
                    try {
                        rawFields = JSON.parse(rawFields);
                    } catch (e) {
                        console.error('VariableCheatSheet: Failed to parse fields JSON', e);
                        rawFields = [];
                    }
                }

                const fields = rawFields as any[];

                // Filter out non-input fields like separators/images
                const inputFields = fields.filter(f => f?.type !== 'separator' && f?.type !== 'image');
                console.log('VariableCheatSheet: Extracted input fields:', inputFields);

                if (inputFields.length > 0) {
                    const mappedVariables = inputFields.map(field => ({
                        key: `{{${field.name}}}`,
                        description: field.label,
                        example: field.placeholder || (field.options ? field.options[0] : 'Data Siswa')
                    }));

                    setCustomGroup({
                        id: 'custom_form',
                        name: 'Field Pendaftaran (Custom Form)',
                        description: 'Variabel dinamis berdasarkan form registrasi yang dibuat dari Form Builder.',
                        variables: mappedVariables
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching custom fields for cheat sheet:', error);
        } finally {
            setLoadingCustom(false);
        }
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(text);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
            >
                <HelpCircle className="h-4 w-4" />
                {buttonText}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 z-50 w-[450px] max-w-[90vw] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[500px]">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h3 className="font-semibold text-slate-800">Kamus Variabel Template</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Klik ikon copy untuk menyalin variabel</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
                            >
                                <ChevronUp className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-2">
                            {[...VARIABLE_DICTIONARY, ...(customGroup ? [customGroup] : [])].map((group) => {
                                const isExpanded = expandedGroups.includes(group.id);
                                return (
                                    <div key={group.id} className="mb-2 last:mb-0 border border-slate-100 rounded-lg overflow-hidden bg-white">
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.id)}
                                            className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 transition-colors"
                                        >
                                            <div>
                                                <h4 className="text-sm font-semibold text-slate-700">{group.name}</h4>
                                                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{group.description}</p>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                            )}
                                        </button>

                                        {isExpanded && (
                                            <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-3">
                                                {group.variables.map((v) => (
                                                    <div key={v.key} className="flex gap-3 items-start group">
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(v.key)}
                                                            className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors group-hover:shadow-sm"
                                                            title="Salin Variabel"
                                                        >
                                                            {copiedKey === v.key ? (
                                                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                            ) : (
                                                                <Copy className="h-3 w-3 text-slate-400 group-hover:text-blue-500" />
                                                            )}
                                                            {v.key}
                                                        </button>
                                                        <div className="flex-1 mt-0.5">
                                                            <p className="text-xs text-slate-700 font-medium">{v.description}</p>
                                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                                <span className="font-medium text-slate-400">Contoh: </span>
                                                                {v.example}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-3 bg-blue-50 border-t border-blue-100 text-xs text-blue-800 leading-relaxed font-medium">
                            💡 Tips: Variabel yang tidak didukung oleh modul pengirim akan otomatis dikosongkan saat pesan terkirim.
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
