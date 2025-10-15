-- Normalize user feedback fields: add category, rating, and device info
-- Safe to run multiple times due to IF NOT EXISTS guards

BEGIN;

-- Create enum type for feedback category, if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'feedback_category' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.feedback_category AS ENUM ('bug', 'feature', 'question', 'other');
  END IF;
END $$;

-- Add columns to public.user_feedback (table is expected to already exist)
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS category public.feedback_category NOT NULL DEFAULT 'bug',
  ADD COLUMN IF NOT EXISTS rating smallint CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS device_info text;

-- Helpful indices
CREATE INDEX IF NOT EXISTS user_feedback_created_at_idx ON public.user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS user_feedback_category_idx ON public.user_feedback(category);

-- Helpful comments
COMMENT ON COLUMN public.user_feedback.category IS 'User-provided category: bug, feature, question, other';
COMMENT ON COLUMN public.user_feedback.rating IS 'Optional 1-5 rating';
COMMENT ON COLUMN public.user_feedback.device_info IS 'Optional device/platform info captured from client';

COMMIT;
