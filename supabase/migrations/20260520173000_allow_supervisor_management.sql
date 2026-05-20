-- Migration: Allow supervisors to manage system features (Farm Zones, Access Codes, User Roles, Profiles, Audit Logs)

-- 1) access_codes: allow both admins and supervisors to manage
DROP POLICY IF EXISTS "Admins can manage access codes" ON public.access_codes;
DROP POLICY IF EXISTS "Admins and supervisors can manage access codes" ON public.access_codes;
CREATE POLICY "Admins and supervisors can manage access codes" ON public.access_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

-- 2) farm_zones: allow both admins and supervisors to manage
DROP POLICY IF EXISTS "Admins can manage zones" ON public.farm_zones;
DROP POLICY IF EXISTS "Admins and supervisors can manage zones" ON public.farm_zones;
CREATE POLICY "Admins and supervisors can manage zones" ON public.farm_zones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

-- 3) profiles: allow both admins and supervisors to view all profiles and update them for approvals
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and supervisors can view all profiles" ON public.profiles;
CREATE POLICY "Admins and supervisors can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins can update profiles for approval" ON public.profiles;
DROP POLICY IF EXISTS "Admins and supervisors can update profiles for approval" ON public.profiles;
CREATE POLICY "Admins and supervisors can update profiles for approval" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

-- 4) user_roles: allow both admins and supervisors to insert and manage roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and supervisors can manage all roles" ON public.user_roles;
CREATE POLICY "Admins and supervisors can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and supervisors can insert user roles" ON public.user_roles;
CREATE POLICY "Admins and supervisors can insert user roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

-- 5) audit_logs: allow both admins and supervisors to view
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins and supervisors can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins and supervisors can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));
