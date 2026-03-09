import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutosaveStatus } from '../components/shared/AutosaveIndicator';

interface UseAutosaveOptions {
    data: unknown;
    onSave: (data: unknown) => Promise<void>;
    interval?: number;  // ms, default 3000
    enabled?: boolean;
}

export function useAutosave({ data, onSave, interval = 3000, enabled = true }: UseAutosaveOptions) {
    const [status, setStatus] = useState<AutosaveStatus>('idle');
    const lastSavedRef = useRef<string>('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const save = useCallback(async () => {
        const serialized = JSON.stringify(data);
        if (serialized === lastSavedRef.current) return;

        try {
            setStatus('saving');
            await onSave(data);
            lastSavedRef.current = serialized;
            setStatus('saved');

            // Reset to idle after 2 seconds
            setTimeout(() => setStatus('idle'), 2000);
        } catch {
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    }, [data, onSave]);

    useEffect(() => {
        if (!enabled) return;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(save, interval);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [data, save, interval, enabled]);

    return { status, save };
}
