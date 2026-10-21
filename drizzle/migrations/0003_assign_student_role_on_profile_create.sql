-- Every new account is created as a Student. The role is set by a
-- SECURITY DEFINER trigger, never by client code, and is hardcoded to
-- 'student' so no signup path can grant itself 'admin'.
CREATE OR REPLACE FUNCTION public.assign_default_student_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_default_role ON public.profiles;
CREATE TRIGGER trg_profiles_default_role
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_default_student_role();

-- Hard guarantee: only the service role (database / project
-- owner) may create or change an 'admin' role row. No client session,
-- signed-in or otherwise, can grant admin — not even an existing admin
-- through the app.
CREATE OR REPLACE FUNCTION public.guard_admin_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS NULL
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.role = 'admin'::app_role)
     OR (TG_OP = 'UPDATE' AND (NEW.role = 'admin'::app_role OR OLD.role = 'admin'::app_role))
     OR (TG_OP = 'DELETE' AND OLD.role = 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin roles can only be managed directly in the database';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_admin_guard ON public.user_roles;
CREATE TRIGGER trg_user_roles_admin_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role_changes();
