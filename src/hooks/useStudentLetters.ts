import { useState, useEffect } from 'react';
import { getAvailableLettersForStudent, GeneratedLetter } from '../lib/letterAccess';
import { getGlobalDocumentsForStudent, DocumentWithDownloadInfo } from '../lib/documentAccess';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function useStudentLetters() {
  const { user } = useAuth();
  const [letters, setLetters] = useState<GeneratedLetter[]>([]);
  const [documents, setDocuments] = useState<DocumentWithDownloadInfo[]>([]);
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [applicantStatus, setApplicantStatus] = useState<'draft' | 'submitted' | 'approved' | 'rejected'>('draft');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLetters = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [lettersResult, documentsResult] = await Promise.all([
      getAvailableLettersForStudent(user.id),
      getGlobalDocumentsForStudent(user.id)
    ]);

    let fetchedApplicantId: string | null = null;

    if (lettersResult.error) {
      setError(lettersResult.error.message);
      setLetters([]);
    } else if (lettersResult.data) {
      setLetters(lettersResult.data.letters);
      setApplicantStatus(lettersResult.data.applicantStatus);
      if (lettersResult.data.letters.length > 0) {
        fetchedApplicantId = lettersResult.data.letters[0].applicant_id;
        setApplicantId(fetchedApplicantId);
      }
    }

    if (documentsResult.error) {
      console.error('Error fetching documents:', documentsResult.error);
      setDocuments([]);
    } else {
      setDocuments(documentsResult.data);
      setApplicantStatus(documentsResult.applicantStatus);
    }

    if (!fetchedApplicantId && user) {
      const { data: applicant } = await supabase
        .from('applicants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (applicant) {
        setApplicantId(applicant.id);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLetters();
  }, [user]);

  return {
    letters,
    documents,
    applicantId,
    applicantStatus,
    loading,
    error,
    refetch: fetchLetters
  };
}
