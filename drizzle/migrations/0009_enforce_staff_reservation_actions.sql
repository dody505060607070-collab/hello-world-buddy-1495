DROP POLICY IF EXISTS "view reservations" ON public.reservations;
DROP POLICY IF EXISTS "create reservations" ON public.reservations;
DROP POLICY IF EXISTS "edit reservations" ON public.reservations;
DROP POLICY IF EXISTS "delete reservations" ON public.reservations;

CREATE POLICY "staff view reservations"
ON public.reservations FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "staff create reservations"
ON public.reservations FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "staff edit reservations"
ON public.reservations FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff delete reservations"
ON public.reservations FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_reservation(
  _property_id uuid,
  _employee_id uuid,
  _contact_id uuid DEFAULT NULL,
  _duration_hours integer DEFAULT 24,
  _notes text DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created public.reservations;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'RESERVATION_FORBIDDEN'; END IF;
  PERFORM public.expire_reservations();
  IF _duration_hours NOT IN (24, 48, 72, 168) THEN RAISE EXCEPTION 'RESERVATION_INVALID_DURATION'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _employee_id AND is_active) THEN
    RAISE EXCEPTION 'RESERVATION_EMPLOYEE_REQUIRED';
  END IF;
  INSERT INTO public.reservations (property_id, employee_id, contact_id, starts_at, ends_at, notes, status, created_by)
  VALUES (_property_id, _employee_id, _contact_id, now(), now() + make_interval(hours => _duration_hours), NULLIF(btrim(_notes), ''), 'active', auth.uid())
  RETURNING * INTO created;
  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.extend_reservation(_reservation_id uuid)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE changed public.reservations;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'RESERVATION_FORBIDDEN'; END IF;
  PERFORM public.expire_reservations();
  UPDATE public.reservations SET ends_at = ends_at + interval '24 hours', extended_count = extended_count + 1, updated_at = now()
  WHERE id = _reservation_id AND status IN ('hold', 'active') AND ends_at > now()
  RETURNING * INTO changed;
  IF changed.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;
  RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_reservation(_reservation_id uuid)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE changed public.reservations;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'RESERVATION_FORBIDDEN'; END IF;
  PERFORM public.expire_reservations();
  UPDATE public.reservations SET status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), updated_at = now()
  WHERE id = _reservation_id AND status IN ('hold', 'active') AND ends_at > now()
  RETURNING * INTO changed;
  IF changed.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;
  RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_reservation_to_contract(_reservation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservation_row public.reservations;
  property_row public.properties;
  new_contract_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'RESERVATION_FORBIDDEN'; END IF;
  PERFORM public.expire_reservations();
  SELECT * INTO reservation_row FROM public.reservations
  WHERE id = _reservation_id AND status IN ('hold', 'active') AND ends_at > now()
  FOR UPDATE;
  IF reservation_row.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;
  SELECT * INTO property_row FROM public.properties WHERE id = reservation_row.property_id;
  INSERT INTO public.contracts (contract_number, contract_type, owner_id, tenant_id, property_id, unit_id, start_date, status, source, created_by)
  VALUES ('RSV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), CASE WHEN property_row.purpose = 'sale' THEN 'sale' ELSE 'rent' END, property_row.owner_id, reservation_row.contact_id, reservation_row.property_id, reservation_row.unit_id, current_date, 'draft', 'reservation', auth.uid())
  RETURNING id INTO new_contract_id;
  UPDATE public.reservations SET status = 'converted', contract_id = new_contract_id, converted_by = auth.uid(), converted_at = now(), updated_at = now()
  WHERE id = reservation_row.id;
  RETURN new_contract_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation(uuid, uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extend_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convert_reservation_to_contract(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, uuid, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extend_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_reservation_to_contract(uuid) TO authenticated, service_role;