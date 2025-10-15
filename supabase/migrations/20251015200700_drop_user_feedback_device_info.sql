-- Drop device_info column from user_feedback
-- This will permanently remove any stored device information from existing feedback rows.

BEGIN;

ALTER TABLE public.user_feedback
  DROP COLUMN IF EXISTS device_info;

COMMIT;
