-- Snapshot of live Bookz RPC (wsnqmjzmtjpezkzlzhra), 2026-08-24.
-- Identity ≠ membership: after Authelia/email session, ensure profile and
-- optionally redeem an invite. EXECUTE for authenticated only.

CREATE OR REPLACE FUNCTION public.membership_after_auth(p_code text DEFAULT NULL::text, p_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_member boolean;
  v_redeemed boolean := false;
  v_err text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'нужна аутентификация'; END IF;
  v_email := public.current_email();
  v_name := coalesce(
    nullif(btrim(p_name), ''),
    nullif(btrim(coalesce(auth.jwt()->'user_metadata'->>'name','')), ''),
    nullif(btrim(coalesce(auth.jwt()->'user_metadata'->>'full_name','')), ''),
    nullif(split_part(coalesce(v_email,''), '@', 1), ''),
    'Читатель'
  );
  INSERT INTO public.profiles(user_id, email, name)
  VALUES (v_uid, coalesce(v_email,''), v_name)
  ON CONFLICT (user_id) DO UPDATE SET
    email = excluded.email,
    name = CASE WHEN coalesce(profiles.name,'') = '' THEN excluded.name ELSE profiles.name END,
    last_seen = now();
  IF coalesce(btrim(p_code),'') <> '' THEN
    BEGIN
      PERFORM public.invite_redeem(p_code, v_name);
      v_redeemed := true;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
    END;
  END IF;
  v_member := public.is_member();
  RETURN jsonb_build_object(
    'ok', true,
    'member', v_member,
    'redeemed', v_redeemed,
    'name', v_name,
    'invite_error', v_err
  );
END
$function$;

REVOKE ALL ON FUNCTION public.membership_after_auth(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.membership_after_auth(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.membership_after_auth(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.membership_after_auth(text, text) TO service_role;
