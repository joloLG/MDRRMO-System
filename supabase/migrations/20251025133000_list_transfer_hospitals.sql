-- Migration: list transfer hospitals helper function
-- Date: 2025-10-25

CREATE OR REPLACE FUNCTION public.list_transfer_hospitals()
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT h.id, h.name
  FROM public.hospitals h
  ORDER BY h.name;
$$;

GRANT EXECUTE ON FUNCTION public.list_transfer_hospitals() TO authenticated;
