-- ============================================================
-- WAWANCARA (Interview Scoring System) Schema
-- Integrated from standalone Wawancara app into SPMB
-- ============================================================

-- CRITERIA: Kriteria penilaian wawancara (bobot 1-10, skor 1-5)
CREATE TABLE IF NOT EXISTS wawancara_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  weight INTEGER NOT NULL DEFAULT 5 CHECK (weight >= 1 AND weight <= 10),
  scoring_rubric TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QUESTION BANK: Bank soal per kriteria
CREATE TABLE IF NOT EXISTS wawancara_question_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  criteria_id UUID NOT NULL REFERENCES wawancara_criteria(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_guide TEXT NOT NULL DEFAULT '',
  ai_rubric TEXT NOT NULL DEFAULT '',
  scoring_rubric TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INTERVIEWS: Sesi wawancara per kandidat
CREATE TABLE IF NOT EXISTS wawancara_interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID REFERENCES applicants(id) ON DELETE SET NULL,
  interviewer_id UUID REFERENCES profiles(user_id),
  candidate_name TEXT NOT NULL DEFAULT '',
  candidate_registration_no TEXT NOT NULL DEFAULT '',
  candidate_origin_school TEXT NOT NULL DEFAULT '',
  candidate_birth_date DATE,
  candidate_parent_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  general_notes TEXT NOT NULL DEFAULT '',
  final_recommendation TEXT NOT NULL DEFAULT '',
  total_score NUMERIC(4,2) DEFAULT 0,
  weighted_score NUMERIC(4,2) DEFAULT 0,
  autosave_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wawancara_interviews_status ON wawancara_interviews(status);
CREATE INDEX IF NOT EXISTS idx_wawancara_interviews_interviewer ON wawancara_interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_wawancara_interviews_applicant ON wawancara_interviews(applicant_id);

-- SCORES: Skor per kriteria per interview
CREATE TABLE IF NOT EXISTS wawancara_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID NOT NULL REFERENCES wawancara_interviews(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES wawancara_criteria(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 5),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(interview_id, criteria_id)
);

-- NOTES: Catatan jawaban per pertanyaan
CREATE TABLE IF NOT EXISTS wawancara_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID NOT NULL REFERENCES wawancara_interviews(id) ON DELETE CASCADE,
  question_id UUID REFERENCES wawancara_question_bank(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL DEFAULT '',
  answer_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI ANALYSES: Hasil analisis AI
CREATE TABLE IF NOT EXISTS wawancara_ai_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID NOT NULL REFERENCES wawancara_interviews(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES wawancara_criteria(id) ON DELETE CASCADE,
  question_id UUID REFERENCES wawancara_question_bank(id) ON DELETE SET NULL,
  analysis_type TEXT NOT NULL DEFAULT 'per_criteria',
  input_text TEXT NOT NULL DEFAULT '',
  suggested_score INTEGER NOT NULL DEFAULT 0,
  justification TEXT NOT NULL DEFAULT '',
  feedback TEXT NOT NULL DEFAULT '',
  model_used TEXT NOT NULL DEFAULT '',
  accepted BOOLEAN DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wawancara_ai_interview ON wawancara_ai_analyses(interview_id);
CREATE INDEX IF NOT EXISTS idx_wawancara_ai_criteria ON wawancara_ai_analyses(criteria_id);

-- SEED: Default criteria
INSERT INTO wawancara_criteria (name, description, weight, sort_order) VALUES
  ('Motivasi Belajar', 'Penilaian terhadap semangat dan alasan siswa ingin bersekolah di sini', 8, 1),
  ('Kemampuan Komunikasi', 'Kemampuan siswa dalam menyampaikan pikiran dan menjawab pertanyaan', 7, 2),
  ('Pengetahuan Umum', 'Wawasan umum siswa tentang pendidikan dan lingkungan sekitar', 6, 3),
  ('Sikap dan Perilaku', 'Kesopanan, kepercayaan diri, dan sikap selama wawancara', 8, 4),
  ('Dukungan Orang Tua', 'Keterlibatan dan dukungan orang tua terhadap pendidikan anak', 5, 5),
  ('Kesiapan Akademik', 'Kesiapan dasar akademik siswa untuk mengikuti pembelajaran', 6, 6)
ON CONFLICT DO NOTHING;

-- SEED: Default questions per criteria
INSERT INTO wawancara_question_bank (criteria_id, question_text, answer_guide, sort_order)
SELECT c.id, q.question_text, q.answer_guide, q.sort_order
FROM wawancara_criteria c
CROSS JOIN LATERAL (
  VALUES
    (CASE c.name
      WHEN 'Motivasi Belajar' THEN 'Mengapa kamu ingin bersekolah di sini?'
      WHEN 'Kemampuan Komunikasi' THEN 'Ceritakan tentang dirimu, keluargamu, dan hobimu!'
      WHEN 'Pengetahuan Umum' THEN 'Siapa nama presiden Indonesia saat ini?'
      WHEN 'Sikap dan Perilaku' THEN 'Apa yang akan kamu lakukan jika melihat temanmu kesulitan?'
      WHEN 'Dukungan Orang Tua' THEN 'Siapa yang paling mendukungmu untuk bersekolah di sini?'
      WHEN 'Kesiapan Akademik' THEN 'Mata pelajaran apa yang paling kamu sukai? Mengapa?'
    END,
    CASE c.name
      WHEN 'Motivasi Belajar' THEN 'Jawaban ideal menunjukkan pengetahuan tentang sekolah dan motivasi intrinsik'
      WHEN 'Kemampuan Komunikasi' THEN 'Perhatikan kelancaran, struktur cerita, dan kepercayaan diri'
      WHEN 'Pengetahuan Umum' THEN 'Jawaban benar: Prabowo Subianto. Perhatikan juga wawasan tambahan'
      WHEN 'Sikap dan Perilaku' THEN 'Jawaban ideal menunjukkan empati dan keinginan membantu'
      WHEN 'Dukungan Orang Tua' THEN 'Perhatikan kehadiran orang tua dan keterlibatan mereka'
      WHEN 'Kesiapan Akademik' THEN 'Perhatikan antusiasme dan kemampuan menjelaskan alasan'
    END, 1)
) AS q(question_text, answer_guide, sort_order)
WHERE q.question_text IS NOT NULL;

INSERT INTO wawancara_question_bank (criteria_id, question_text, answer_guide, sort_order)
SELECT c.id, q.question_text, q.answer_guide, q.sort_order
FROM wawancara_criteria c
CROSS JOIN LATERAL (
  VALUES
    (CASE c.name
      WHEN 'Motivasi Belajar' THEN 'Apa cita-citamu ketika besar nanti?'
      WHEN 'Kemampuan Komunikasi' THEN 'Jika kamu bisa pergi ke mana saja, ke mana kamu akan pergi dan mengapa?'
      WHEN 'Pengetahuan Umum' THEN 'Apa ibu kota provinsi tempat tinggalmu?'
      WHEN 'Sikap dan Perilaku' THEN 'Bagaimana sikapmu ketika ada teman yang berbeda pendapat denganmu?'
      WHEN 'Dukungan Orang Tua' THEN 'Bagaimana orang tuamu membantumu belajar di rumah?'
      WHEN 'Kesiapan Akademik' THEN 'Ceritakan satu hal baru yang kamu pelajari minggu ini!'
    END,
    CASE c.name
      WHEN 'Motivasi Belajar' THEN 'Perhatikan kejelasan visi dan hubungannya dengan pendidikan'
      WHEN 'Kemampuan Komunikasi' THEN 'Perhatikan imajinasi, logika, dan kemampuan berargumen'
      WHEN 'Pengetahuan Umum' THEN 'Perhatikan pengetahuan geografi dasar'
      WHEN 'Sikap dan Perilaku' THEN 'Jawaban ideal menunjukkan toleransi dan kemampuan menghargai perbedaan'
      WHEN 'Dukungan Orang Tua' THEN 'Perhatikan pola belajar di rumah dan peran orang tua'
      WHEN 'Kesiapan Akademik' THEN 'Perhatikan rasa ingin tahu dan kemampuan mengingat pelajaran'
    END, 2)
) AS q(question_text, answer_guide, sort_order)
WHERE q.question_text IS NOT NULL;
