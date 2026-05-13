
-- 1. Protect sensitive profile columns via trigger
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow sensitive columns to be changed by the service role (server-side)
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' <> 'service_role' THEN
    NEW.xp := OLD.xp;
    NEW.streak := OLD.streak;
    NEW.last_active := OLD.last_active;
    NEW.onboarded := OLD.onboarded;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- 2. Remove client-side badge insert ability
DROP POLICY IF EXISTS "users insert own badges" ON public.user_badges;

-- 3. Explicit restrictive policy on user_roles to ensure non-admins cannot insert/update/delete
DROP POLICY IF EXISTS "only admins write roles" ON public.user_roles;
CREATE POLICY "only admins write roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Allow enrolled students to read quizzes belonging to courses they enrolled in
DROP POLICY IF EXISTS "enrolled students read course quizzes" ON public.quizzes;
CREATE POLICY "enrolled students read course quizzes"
ON public.quizzes
FOR SELECT
TO authenticated
USING (
  course_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = quizzes.course_id
      AND e.user_id = auth.uid()
  )
);

-- 5. Restrict has_role execution to trusted roles (used internally by RLS policies which run as definer)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
