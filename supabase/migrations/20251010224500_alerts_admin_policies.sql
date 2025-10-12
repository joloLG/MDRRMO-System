-- Allow admins/superadmins to SELECT all push_subscriptions for broadcasting
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'Admins can read all subscriptions'
  ) THEN
    CREATE POLICY "Admins can read all subscriptions" ON public.push_subscriptions
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin'))
      );
  END IF;
END $$;

-- Allow admins/superadmins to SELECT basic user info (email) for broadcasting
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Admins can read users for broadcast'
  ) THEN
    CREATE POLICY "Admins can read users for broadcast" ON public.users
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.user_type IN ('admin','superadmin'))
      );
  END IF;
END $$;
