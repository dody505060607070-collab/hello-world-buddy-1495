DROP POLICY IF EXISTS "staff insert activity" ON public.activity_log;
CREATE POLICY "staff insert activity" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()) AND (actor_id IS NULL OR actor_id = auth.uid()));

DROP POLICY IF EXISTS "add opp history" ON public.opportunity_stage_history;
CREATE POLICY "add opp history" ON public.opportunity_stage_history
  FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()) AND (changed_by IS NULL OR changed_by = auth.uid()));

DROP POLICY IF EXISTS "staff add status history" ON public.request_status_history;
CREATE POLICY "staff add status history" ON public.request_status_history
  FOR INSERT TO authenticated
  WITH CHECK (has_perm(auth.uid(), 'requests'::text, 'edit'::text) AND (changed_by IS NULL OR changed_by = auth.uid()));

DROP POLICY IF EXISTS "add task history" ON public.task_history;
CREATE POLICY "add task history" ON public.task_history
  FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()) AND (actor_id IS NULL OR actor_id = auth.uid()));