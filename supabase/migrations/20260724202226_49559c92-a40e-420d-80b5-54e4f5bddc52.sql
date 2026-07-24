
CREATE TABLE public.attorney_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  title TEXT NOT NULL,
  specialty TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.attorney_submissions TO anon;
GRANT SELECT, INSERT ON public.attorney_submissions TO authenticated;
GRANT ALL ON public.attorney_submissions TO service_role;

ALTER TABLE public.attorney_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can view submissions (public directory)
CREATE POLICY "Anyone can view submissions"
  ON public.attorney_submissions FOR SELECT
  USING (true);

-- Anyone can insert a submission (self-serve sign-up), forced to pending
CREATE POLICY "Anyone can submit"
  ON public.attorney_submissions FOR INSERT
  WITH CHECK (status = 'pending');
