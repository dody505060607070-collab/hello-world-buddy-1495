ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS converted_by uuid,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_PROPERTY_REQUIRED';
  END IF;
  IF NEW.employee_id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_EMPLOYEE_REQUIRED';
  END IF;
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'RESERVATION_INVALID_DURATION';
  END IF;
  IF NEW.status NOT IN ('hold', 'active', 'cancelled', 'converted', 'expired') THEN
    RAISE EXCEPTION 'RESERVATION_INVALID_STATUS';
  END IF;
  IF NEW.status IN ('hold', 'active') AND EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.id <> NEW.id
      AND r.status IN ('hold', 'active')
      AND r.ends_at > now()
      AND ((NEW.property_id IS NOT NULL AND r.property_id = NEW.property_id)
        OR (NEW.unit_id IS NOT NULL AND r.unit_id = NEW.unit_id))
      AND NEW.starts_at < r.ends_at
      AND NEW.ends_at > r.starts_at
  ) THEN
    RAISE EXCEPTION 'RESERVATION_CONFLICT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_no_overlap ON public.reservations;
CREATE TRIGGER reservations_no_overlap
BEFORE INSERT OR UPDATE OF property_id, unit_id, starts_at, ends_at, status
ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.validate_reservation();

CREATE OR REPLACE FUNCTION public.expire_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.reservations
  SET status = 'expired', updated_at = now()
  WHERE status IN ('hold', 'active')
    AND ends_at <= now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_reservation(
  _property_id uuid,
  _employee_id uuid,
  _contact_id uuid DEFAULT NULL,
  _duration_hours integer DEFAULT 24,
  _notes text DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  created public.reservations;
BEGIN
  PERFORM public.expire_reservations();
  IF _duration_hours NOT IN (24, 48, 72, 168) THEN
    RAISE EXCEPTION 'RESERVATION_INVALID_DURATION';
  END IF;
  INSERT INTO public.reservations (
    property_id, employee_id, contact_id, starts_at, ends_at, notes, status, created_by
  ) VALUES (
    _property_id, _employee_id, _contact_id, now(), now() + make_interval(hours => _duration_hours),
    NULLIF(btrim(_notes), ''), 'active', auth.uid()
  )
  RETURNING * INTO created;
  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.extend_reservation(_reservation_id uuid)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  changed public.reservations;
BEGIN
  PERFORM public.expire_reservations();
  UPDATE public.reservations
  SET ends_at = ends_at + interval '24 hours',
      extended_count = extended_count + 1,
      updated_at = now()
  WHERE id = _reservation_id
    AND status IN ('hold', 'active')
    AND ends_at > now()
  RETURNING * INTO changed;
  IF changed.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE';
  END IF;
  RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_reservation(_reservation_id uuid)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  changed public.reservations;
BEGIN
  PERFORM public.expire_reservations();
  UPDATE public.reservations
  SET status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), updated_at = now()
  WHERE id = _reservation_id
    AND status IN ('hold', 'active')
    AND ends_at > now()
  RETURNING * INTO changed;
  IF changed.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE';
  END IF;
  RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_reservation_to_contract(_reservation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  reservation_row public.reservations;
  property_row public.properties;
  new_contract_id uuid;
BEGIN
  PERFORM public.expire_reservations();
  SELECT * INTO reservation_row
  FROM public.reservations
  WHERE id = _reservation_id
    AND status IN ('hold', 'active')
    AND ends_at > now()
  FOR UPDATE;
  IF reservation_row.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE';
  END IF;

  SELECT * INTO property_row
  FROM public.properties
  WHERE id = reservation_row.property_id;

  INSERT INTO public.contracts (
    contract_number, contract_type, owner_id, tenant_id, property_id, unit_id,
    start_date, status, source, created_by
  ) VALUES (
    'RSV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    CASE WHEN property_row.purpose = 'sale' THEN 'sale' ELSE 'rent' END,
    property_row.owner_id, reservation_row.contact_id, reservation_row.property_id,
    reservation_row.unit_id, current_date, 'draft', 'reservation', auth.uid()
  ) RETURNING id INTO new_contract_id;

  UPDATE public.reservations
  SET status = 'converted', contract_id = new_contract_id,
      converted_by = auth.uid(), converted_at = now(), updated_at = now()
  WHERE id = reservation_row.id;

  RETURN new_contract_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation(uuid, uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extend_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convert_reservation_to_contract(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, uuid, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extend_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_reservation_to_contract(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_reservations() TO authenticated, service_role;