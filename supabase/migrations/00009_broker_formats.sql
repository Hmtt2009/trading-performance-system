-- Broker Formats: store learned CSV column mappings for auto-detection
-- Shared across all users so the system learns new broker formats over time

CREATE TABLE public.broker_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who created this mapping
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Format identification
  format_name TEXT NOT NULL,
  format_fingerprint TEXT UNIQUE NOT NULL,

  -- Column mappings (the actual header names from the CSV)
  column_symbol TEXT NOT NULL,
  column_datetime TEXT NOT NULL,
  column_side TEXT,
  column_quantity TEXT NOT NULL,
  column_price TEXT NOT NULL,
  column_commission TEXT,
  column_proceeds TEXT,
  column_currency TEXT,
  column_account TEXT,
  column_asset_category TEXT,

  -- Metadata
  header_row_index INTEGER NOT NULL DEFAULT 0,
  sample_headers TEXT[] NOT NULL,
  times_used INTEGER NOT NULL DEFAULT 1,
  confidence_score INTEGER NOT NULL DEFAULT 100,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- format_fingerprint already has a UNIQUE constraint (implicit index)
CREATE INDEX idx_broker_formats_times_used ON public.broker_formats(times_used DESC);

-- Updated_at trigger (reuses function from initial migration)
CREATE TRIGGER broker_formats_updated_at
  BEFORE UPDATE ON public.broker_formats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Row Level Security
ALTER TABLE public.broker_formats ENABLE ROW LEVEL SECURITY;

-- Anyone can read broker formats (shared knowledge)
CREATE POLICY broker_formats_select ON public.broker_formats
  FOR SELECT USING (true);

-- Only authenticated users can insert
CREATE POLICY broker_formats_insert ON public.broker_formats
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Any authenticated user can update (shared knowledge, e.g. incrementing times_used)
CREATE POLICY broker_formats_update ON public.broker_formats
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Only the creator can delete their own formats
CREATE POLICY broker_formats_delete ON public.broker_formats
  FOR DELETE USING (auth.uid() = created_by);
