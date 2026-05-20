
-- 1. Remove email from profiles (teacher email-leak fix)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Update handle_new_user to not write email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$function$;

-- Update protect_profile_sensitive_columns to not reference email
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' <> 'service_role' THEN
    NEW.xp := OLD.xp;
    NEW.streak := OLD.streak;
    NEW.last_active := OLD.last_active;
    NEW.onboarded := OLD.onboarded;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Quiz attempts: remove permissive INSERT policy, force inserts through server function (service role)
DROP POLICY IF EXISTS "users create own attempts" ON public.quiz_attempts;

-- 3. Lightweight rate-limiting table for AI calls
CREATE TABLE IF NOT EXISTS public.ai_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_call_log_user_time_idx ON public.ai_call_log (user_id, created_at DESC);
ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (server functions) can read/write.
