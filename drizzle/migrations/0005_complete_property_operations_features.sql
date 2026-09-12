ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS close_probability integer NOT NULL DEFAULT 50;

DO $$ BEGIN
  ALTER TABLE public.opportunities
    ADD CONSTRAINT opportunities_close_probability_check
    CHECK (close_probability BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS tasks_contract_id_idx ON public.tasks(contract_id);

CREATE OR REPLACE FUNCTION public.create_contract_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tasks (title, details, task_type, priority, status, due_date, contract_id, property_id, contact_id, assigned_by)
  VALUES
    ('تحصيل أول دفعة للعقد ' || NEW.contract_number, 'مراجعة وتحصيل أول دفعة مستحقة للعقد الجديد.', 'contract_collection', 'high', 'new', COALESCE(NEW.start_date, CURRENT_DATE), NEW.id, NEW.property_id, NEW.tenant_id, NEW.created_by),
    ('تسليم مفاتيح العقد ' || NEW.contract_number, 'تنسيق تسليم المفاتيح وتوثيق حالة التسليم.', 'key_handover', 'normal', 'new', COALESCE(NEW.start_date, CURRENT_DATE), NEW.id, NEW.property_id, NEW.tenant_id, NEW.created_by),
    ('متابعة تجديد العقد ' || NEW.contract_number, 'التواصل مع الأطراف قبل انتهاء العقد لتحديد قرار التجديد.', 'contract_renewal', 'normal', 'new', COALESCE(NEW.end_date - 30, CURRENT_DATE + 30), NEW.id, NEW.property_id, NEW.tenant_id, NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_contract_tasks_after_insert ON public.contracts;
CREATE TRIGGER create_contract_tasks_after_insert
AFTER INSERT ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.create_contract_tasks();

CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  signer_role text NOT NULL DEFAULT 'tenant',
  image_data text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.contract_signatures TO authenticated;
GRANT ALL ON public.contract_signatures TO service_role;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view permitted contract signatures" ON public.contract_signatures
FOR SELECT TO authenticated
USING (
  public.has_perm(auth.uid(), 'contracts', 'view')
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.client_accounts ca ON ca.contact_id = c.tenant_id
    WHERE c.id = contract_signatures.contract_id AND ca.user_id = auth.uid()
  )
);
CREATE POLICY "sign permitted contracts" ON public.contract_signatures
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_perm(auth.uid(), 'contracts', 'edit')
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.client_accounts ca ON ca.contact_id = c.tenant_id
      WHERE c.id = contract_signatures.contract_id AND ca.user_id = auth.uid()
    )
  )
);
CREATE POLICY "delete contract signatures" ON public.contract_signatures
FOR DELETE TO authenticated
USING (public.has_perm(auth.uid(), 'contracts', 'edit'));
CREATE INDEX IF NOT EXISTS contract_signatures_contract_id_idx ON public.contract_signatures(contract_id, signed_at DESC);

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  size_bytes bigint,
  tables_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admins view backups" ON public.backup_runs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX IF NOT EXISTS backup_runs_created_at_idx ON public.backup_runs(created_at DESC);