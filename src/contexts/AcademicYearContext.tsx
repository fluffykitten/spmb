import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AcademicYear {
    id: string;
    name: string;
    code: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface AcademicYearContextType {
    activeYear: AcademicYear | null;
    allYears: AcademicYear[];
    selectedYearId: string | null;
    selectedYear: AcademicYear | null;
    setSelectedYearId: (id: string | null) => void;
    refreshYears: () => Promise<void>;
    loading: boolean;
}

const AcademicYearContext = createContext<AcademicYearContextType>({
    activeYear: null,
    allYears: [],
    selectedYearId: null,
    selectedYear: null,
    setSelectedYearId: () => { },
    refreshYears: async () => { },
    loading: true,
});

export const useAcademicYear = () => useContext(AcademicYearContext);

export const AcademicYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [allYears, setAllYears] = useState<AcademicYear[]>([]);
    const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchYears = async () => {
        try {
            const { data, error } = await supabase
                .from('academic_years')
                .select('*')
                .order('code', { ascending: false });

            if (error) {
                console.error('Error fetching academic years:', error);
                return;
            }

            const years = (data || []) as AcademicYear[];
            setAllYears(years);

            // Auto-select active year if no selection has been made
            if (!selectedYearId) {
                const active = years.find(y => y.is_active);
                if (active) {
                    setSelectedYearId(active.id);
                } else if (years.length > 0) {
                    setSelectedYearId(years[0].id);
                }
            }
        } catch (err) {
            console.error('Error fetching academic years:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchYears();
    }, []);

    const activeYear = allYears.find(y => y.is_active) || null;
    const selectedYear = allYears.find(y => y.id === selectedYearId) || activeYear;

    return (
        <AcademicYearContext.Provider
            value={{
                activeYear,
                allYears,
                selectedYearId,
                selectedYear,
                setSelectedYearId,
                refreshYears: fetchYears,
                loading,
            }}
        >
            {children}
        </AcademicYearContext.Provider>
    );
};
