ALTER TABLE public.message_log
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS message_log_idempotency_key_unique
  ON public.message_log (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_log_task_id_created_idx
  ON public.message_log (task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.task_reminder_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  next_send_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
GRANT SELECT ON public.task_reminder_state TO authenticated;
GRANT ALL ON public.task_reminder_state TO service_role;
ALTER TABLE public.task_reminder_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff view task reminder state"
  ON public.task_reminder_state FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS task_reminder_state_due_idx
  ON public.task_reminder_state (next_send_at);

CREATE TABLE IF NOT EXISTS public.automation_job_state (
  job_name text PRIMARY KEY,
  status text NOT NULL DEFAULT 'ready',
  lease_until timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.automation_job_state TO authenticated;
GRANT ALL ON public.automation_job_state TO service_role;
ALTER TABLE public.automation_job_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins view automation job state"
  ON public.automation_job_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.acquire_automation_lease(
  _job_name text,
  _lease_seconds integer DEFAULT 3300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE acquired boolean;
BEGIN
  INSERT INTO public.automation_job_state (job_name, status, lease_until, last_started_at, updated_at)
  VALUES (_job_name, 'running', now() + make_interval(secs => _lease_seconds), now(), now())
  ON CONFLICT (job_name) DO UPDATE
  SET status = 'running',
      lease_until = now() + make_interval(secs => _lease_seconds),
      last_started_at = now(),
      updated_at = now()
  WHERE automation_job_state.status <> 'paused'
    AND (automation_job_state.lease_until IS NULL OR automation_job_state.lease_until < now());
  GET DIAGNOSTICS acquired = ROW_COUNT;
  RETURN acquired;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_automation_lease(
  _job_name text,
  _error text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.automation_job_state
  SET status = CASE WHEN _error IS NULL THEN 'ready' ELSE 'failed' END,
      lease_until = NULL,
      last_finished_at = now(),
      last_error = _error,
      consecutive_failures = CASE WHEN _error IS NULL THEN 0 ELSE consecutive_failures + 1 END,
      updated_at = now()
  WHERE job_name = _job_name;
$$;