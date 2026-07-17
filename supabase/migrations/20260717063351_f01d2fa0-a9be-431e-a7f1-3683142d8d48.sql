
-- 1. Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  actor_id UUID,
  target_row_id UUID,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_table_created_idx ON public.audit_log (table_name, created_at DESC);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_id, created_at DESC);

-- 2. Grants — admins read via has_role; only service_role writes
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

-- 3. RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies: authenticated clients cannot write.
-- Trigger runs as SECURITY DEFINER; service_role bypasses RLS.

-- 4. Generic audit trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_target UUID;
  v_before JSONB;
  v_after JSONB;
BEGIN
  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_target := (to_jsonb(OLD)->>'id')::UUID;
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_target := (to_jsonb(NEW)->>'id')::UUID;
  ELSE
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_target := (to_jsonb(NEW)->>'id')::UUID;
  END IF;

  INSERT INTO public.audit_log (table_name, action, actor_id, target_row_id, before_data, after_data)
  VALUES (TG_TABLE_NAME, TG_OP, v_actor, v_target, v_before, v_after);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;

-- 5. Attach to enrollments (INSERT/UPDATE/DELETE)
DROP TRIGGER IF EXISTS enrollments_audit ON public.enrollments;
CREATE TRIGGER enrollments_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
