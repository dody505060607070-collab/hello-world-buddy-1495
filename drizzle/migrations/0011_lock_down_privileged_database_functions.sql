CREATE OR REPLACE FUNCTION public.bootstrap_current_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  uname text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.user_id = uid) THEN RETURN; END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
    INTO uemail, uname
    FROM auth.users
    WHERE id = uid;

  INSERT INTO public.profiles (id, full_name, email, is_active, org)
  VALUES (uid, COALESCE(uname, 'مستخدم'), uemail, true, 'rashoudi')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, is_active, org)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    true,
    'rashoudi'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_perm(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_activity(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_task_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_reservation_to_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_reservations() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_properties(text, text, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    to_jsonb(s),
    '{}'::jsonb
  )
  FROM (
    SELECT company_name, phone, whatsapp_number, email, address, about, stats, social_links
    FROM public.app_settings
    WHERE id = true
    LIMIT 1
  ) s;
$$;

REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated, service_role;
DROP POLICY IF EXISTS "public read settings" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon;