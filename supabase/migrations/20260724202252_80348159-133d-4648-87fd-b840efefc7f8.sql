
CREATE POLICY "Public read attorney photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attorney-photos');

CREATE POLICY "Anyone can upload attorney photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attorney-photos');
