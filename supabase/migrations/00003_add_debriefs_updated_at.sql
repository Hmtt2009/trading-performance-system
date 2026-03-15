-- Add updated_at column to ai_debriefs for rate-limiting
-- created_at stays as original creation time; updated_at tracks last regeneration

ALTER TABLE public.ai_debriefs
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows: set updated_at = created_at
UPDATE public.ai_debriefs SET updated_at = created_at;

-- Auto-update on row modification
CREATE OR REPLACE FUNCTION public.update_ai_debriefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_debriefs_updated_at
  BEFORE UPDATE ON public.ai_debriefs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_debriefs_updated_at();
