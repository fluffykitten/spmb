import { Cloud, CloudOff, Check, Loader2, AlertTriangle } from 'lucide-react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface AutosaveIndicatorProps {
    status: AutosaveStatus;
}

export default function AutosaveIndicator({ status }: AutosaveIndicatorProps) {
    const config = {
        idle: { icon: Cloud, text: 'Siap', color: 'text-gray-400' },
        saving: { icon: Loader2, text: 'Menyimpan...', color: 'text-blue-500', animate: true },
        saved: { icon: Check, text: 'Tersimpan', color: 'text-green-500' },
        offline: { icon: CloudOff, text: 'Offline', color: 'text-amber-500' },
        error: { icon: AlertTriangle, text: 'Gagal simpan', color: 'text-red-500' },
    };

    const { icon: Icon, text, color, animate } = config[status] as typeof config['saving'];

    return (
        <div className={`flex items-center gap-1.5 text-xs ${color}`}>
            <Icon className={`w-3.5 h-3.5 ${animate ? 'animate-spin' : ''}`} />
            <span>{text}</span>
        </div>
    );
}
