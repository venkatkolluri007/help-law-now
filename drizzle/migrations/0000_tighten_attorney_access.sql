DROP POLICY IF EXISTS "Anyone can view submissions" ON public.attorney_submissions;
CREATE POLICY "Public can view listed submissions"
  ON public.attorney_submissions FOR SELECT
  TO anon, authenticated
  USING (status IN ('pending', 'approved'));
DROP POLICY IF EXISTS "Public read attorney photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload attorney photos" ON storage.objects;