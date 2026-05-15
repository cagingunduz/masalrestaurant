-- Stage 2: tiny helper RPC the panel login screens use to look up the
-- internal auth e-mail belonging to a staff/admin profile. Returns
-- (id, name, email, role) tuples — no passwords. The internal e-mails
-- are auto-generated (*.masalstaff.internal), not personal data.

CREATE OR REPLACE FUNCTION public.get_login_directory()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'email', email, 'role', role
  ) ORDER BY name), '[]'::jsonb)
  FROM profiles
  WHERE email IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_directory() TO anon, authenticated;
