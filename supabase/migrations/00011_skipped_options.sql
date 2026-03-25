CREATE TABLE public.skipped_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES public.file_uploads(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity DECIMAL(12,4) NOT NULL,
  price DECIMAL(12,4) NOT NULL,
  commission DECIMAL(10,4) NOT NULL DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skipped_options_user ON public.skipped_options(user_id);
CREATE INDEX idx_skipped_options_upload ON public.skipped_options(upload_id);

ALTER TABLE public.skipped_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY skipped_options_user_access ON public.skipped_options
  FOR ALL USING (auth.uid() = user_id);
