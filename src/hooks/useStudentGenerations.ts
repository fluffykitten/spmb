import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface GenerationRecord {
  id: string;
  template_id: string;
  generation_count: number;
  last_generated_at: string;
  downloaded_at: string | null;
  template_name: string;
  template_type: string;
  template_description: string | null;
}

interface UseStudentGenerationsResult {
  totalGenerated: number;
  totalDownloaded: number;
  totalNotDownloaded: number;
  generations: GenerationRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useStudentGenerations = (): UseStudentGenerationsResult => {
  const { user } = useAuth();
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGenerations = async () => {
    if (!user) {
      setGenerations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: applicantData, error: applicantError } = await supabase
        .from('applicants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (applicantError) throw applicantError;

      if (!applicantData) {
        setGenerations([]);
        setLoading(false);
        return;
      }

      const { data, error: genError } = await supabase
        .from('document_generations')
        .select(`
          id,
          template_id,
          generation_count,
          last_generated_at,
          downloaded_at,
          letter_templates!inner (
            name,
            template_type,
            description
          )
        `)
        .eq('applicant_id', applicantData.id)
        .order('last_generated_at', { ascending: false });

      if (genError) throw genError;

      const mappedGenerations: GenerationRecord[] = (data || []).map((gen: any) => ({
        id: gen.id,
        template_id: gen.template_id,
        generation_count: gen.generation_count,
        last_generated_at: gen.last_generated_at,
        downloaded_at: gen.downloaded_at,
        template_name: gen.letter_templates.name,
        template_type: gen.letter_templates.template_type,
        template_description: gen.letter_templates.description,
      }));

      setGenerations(mappedGenerations);
    } catch (err) {
      console.error('Error fetching generations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch generations');
      setGenerations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGenerations();
  }, [user]);

  const totalGenerated = generations.length;
  const totalDownloaded = generations.filter(g => g.downloaded_at !== null).length;
  const totalNotDownloaded = generations.filter(g => g.downloaded_at === null).length;

  return {
    totalGenerated,
    totalDownloaded,
    totalNotDownloaded,
    generations,
    loading,
    error,
    refetch: fetchGenerations,
  };
};
