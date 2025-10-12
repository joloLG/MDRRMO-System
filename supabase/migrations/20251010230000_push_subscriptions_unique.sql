-- Ensure unique upsert key for push_subscriptions matching API onConflict
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND indexname = 'push_subscriptions_user_platform_key'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_platform_key UNIQUE (user_id, platform);
  END IF;
END $$;
