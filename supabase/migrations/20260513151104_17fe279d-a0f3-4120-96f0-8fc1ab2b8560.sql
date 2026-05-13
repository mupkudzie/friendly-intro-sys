
-- 1) user_roles: remove self-insert privilege escalation
DROP POLICY IF EXISTS "Allow admins to insert user roles" ON public.user_roles;
CREATE POLICY "Admins can insert user roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) access_codes: remove public-readable policy, add secure verifier
DROP POLICY IF EXISTS "Anyone can verify access codes" ON public.access_codes;

CREATE OR REPLACE FUNCTION public.verify_access_code(_code text, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.access_codes
    WHERE code = _code AND role = _role AND active = true
  );
$$;
REVOKE EXECUTE ON FUNCTION public.verify_access_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_access_code(text, text) TO anon, authenticated;

-- 3) task_history: restrict insert to the acting user (trigger uses SECURITY DEFINER so it still works)
DROP POLICY IF EXISTS "System can insert task history" ON public.task_history;
CREATE POLICY "Users can insert their own task history"
  ON public.task_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4) audit_logs: restrict insert to the acting user
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert their own audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5) worker_activities: only admins/supervisors can insert (service role bypasses RLS for system inserts)
DROP POLICY IF EXISTS "System can insert worker activities" ON public.worker_activities;
CREATE POLICY "Supervisors and admins can insert worker activities"
  ON public.worker_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role]));

-- 6) Drop unused video feed functions (camera/video feed feature removed per project memory)
DROP FUNCTION IF EXISTS public.get_video_feed_wrapper(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_video_feed_v2(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_video_feed();

-- 7) get_worker_total_hours: add search_path + role check, restrict execute
CREATE OR REPLACE FUNCTION public.get_worker_total_hours(total_hours_threshold numeric)
 RETURNS TABLE(id uuid, user_id uuid, full_name text, total_hours numeric, department text, role user_role)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'supervisor'::user_role])) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.full_name,
        COALESCE(SUM(tl.total_hours), 0) AS total_hours,
        p.department,
        p.role
    FROM public.profiles p
    LEFT JOIN public.time_logs tl ON p.user_id = tl.user_id
    WHERE p.is_deleted = false
    GROUP BY p.id, p.user_id, p.full_name, p.department, p.role
    HAVING COALESCE(SUM(tl.total_hours), 0) >= total_hours_threshold;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_worker_total_hours(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_worker_total_hours(numeric) TO authenticated;

-- 8) Set search_path on get_video_feed leftover (already dropped) — no-op safety; ensure no others remain
