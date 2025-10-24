-- Migration: Create post_likes table for user likes on narrative posts
-- Date: 2025-10-24

CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.narrative_reports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(user_id, post_id) -- Prevent duplicate likes
);

-- Enable RLS
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own likes
CREATE POLICY "Users can manage their own likes"
ON public.post_likes
FOR ALL
USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.post_likes TO authenticated;
