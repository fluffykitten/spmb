import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export const SetupRoute: React.FC = () => {
    const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
    const location = useLocation();

    useEffect(() => {
        const checkSetupStatus = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                const response = await fetch(`${apiUrl}/api/auth/setup-status`);

                if (!response.ok) {
                    throw new Error('Failed to check setup status');
                }

                const data = await response.json();
                setNeedsSetup(data.needsSetup);
            } catch (err) {
                console.error("Error checking setup status:", err);
                // On error, we assume false to not trap the user in setup on network errors
                // or if the backend isn't ready.
                setNeedsSetup(false);
            }
        };

        checkSetupStatus();
    }, []);

    if (needsSetup === null) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p>Starting Application...</p>
                </div>
            </div>
        );
    }

    // If they need setup and they are NOT already on the setup page, redirect to setup
    if (needsSetup && location.pathname !== '/setup') {
        return <Navigate to="/setup" replace />;
    }

    // If they do NOT need setup, and they ARE on the setup page, redirect to login  
    if (!needsSetup && location.pathname === '/setup') {
        return <Navigate to="/login" replace />;
    }

    // Otherwise, render the children routes normally
    return <Outlet />;
};
