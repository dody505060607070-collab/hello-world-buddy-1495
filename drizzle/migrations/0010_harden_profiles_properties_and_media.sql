CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    IF NEW.org IS DISTINCT FROM OLD.org
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      RAISE EXCEPTION 'Security-sensitive profile fields may only be changed by a super administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_security_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_security_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_security_fields();

REVOKE EXECUTE ON FUNCTION public.protect_profile_security_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_security_fields() TO service_role;

DROP POLICY IF EXISTS "staff read property media" ON storage.objects;
CREATE POLICY "staff read property media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'property-media'
  AND public.has_perm(auth.uid(), 'properties', 'view')
);

DROP POLICY IF EXISTS "public read visible properties" ON public.properties;
DROP POLICY IF EXISTS "auth read visible properties" ON public.properties;
DROP POLICY IF EXISTS "staff view properties" ON public.properties;
CREATE POLICY "staff view properties"
ON public.properties
FOR SELECT
TO authenticated
USING (public.has_perm(auth.uid(), 'properties', 'view'));

REVOKE SELECT ON public.properties FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_properties(
  _purpose text DEFAULT NULL,
  _code text DEFAULT NULL,
  _limit integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(result_row) ORDER BY result_row.is_featured DESC, result_row.sort_order ASC, result_row.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      p.id,
      p.code,
      p.name,
      p.purpose,
      p.property_type,
      p.city,
      p.district,
      p.price_text,
      p.price_value,
      p.description,
      p.is_featured,
      p.sort_order,
      p.map_url,
      p.latitude,
      p.longitude,
      p.whatsapp_number,
      p.link_youtube,
      p.link_tiktok,
      p.link_instagram,
      p.link_snapchat,
      p.link_x,
      p.link_facebook,
      p.link_tour,
      p.created_at,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'url', pi.url,
              'is_cover', pi.is_cover,
              'sort_order', pi.sort_order
            ) ORDER BY pi.is_cover DESC, pi.sort_order ASC
          )
          FROM public.property_images pi
          WHERE pi.property_id = p.id
        ),
        '[]'::jsonb
      ) AS property_images
    FROM public.properties p
    WHERE p.is_visible
      AND p.status <> 'archived'
      AND (_purpose IS NULL OR p.purpose = _purpose)
      AND (_code IS NULL OR p.code = _code)
    ORDER BY p.is_featured DESC, p.sort_order ASC, p.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 100)
  ) AS result_row;
$$;

REVOKE ALL ON FUNCTION public.get_public_properties(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_properties(text, text, integer) TO anon, authenticated, service_role;