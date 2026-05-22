-- AMA Earth scaffold — Supabase schema
-- Run this in Supabase SQL Editor → New query → Run

-- Documents table: uploaded files and their processing state
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_url TEXT,
  storage_path TEXT,
  raw_text TEXT,
  extracted_data JSONB,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'extracting', 'extracted', 'generating', 'complete', 'error')),
  error_message TEXT,
  report JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assessments table: groups documents into a project
CREATE TABLE IF NOT EXISTS assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'review', 'complete')),
  report_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Junction table
CREATE TABLE IF NOT EXISTS assessment_documents (
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  doc_type TEXT,
  PRIMARY KEY (assessment_id, document_id)
);

-- Enable realtime for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE documents;
ALTER PUBLICATION supabase_realtime ADD TABLE assessments;

-- Demo-mode policies (PERMISSIVE — fine for live demo, tighten before real use)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_documents_all" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo_assessments_all" ON assessments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo_assessment_documents_all" ON assessment_documents FOR ALL USING (true) WITH CHECK (true);

-- Storage: create the 'uploads' bucket via the dashboard (Storage → New bucket → 'uploads', Public: OFF)
-- Then run this storage policy:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false) ON CONFLICT DO NOTHING;
-- CREATE POLICY "demo_uploads_all" ON storage.objects FOR ALL USING (bucket_id = 'uploads') WITH CHECK (bucket_id = 'uploads');
