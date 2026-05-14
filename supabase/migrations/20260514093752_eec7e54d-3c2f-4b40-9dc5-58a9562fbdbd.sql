-- 1. Allow quiz owners to update their own quizzes
CREATE POLICY "owners update quizzes"
ON public.quizzes
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 2. Allow owners and admins to delete performance events
CREATE POLICY "owners and admins delete performance events"
ON public.performance_events
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Revoke EXECUTE from anon/public on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.protect_profile_sensitive_columns() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;