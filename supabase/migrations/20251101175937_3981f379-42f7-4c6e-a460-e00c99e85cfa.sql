-- Create app_role enum for proper role management
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'student', 'garden_worker');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Add approval_status to profiles
ALTER TABLE public.profiles 
ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Add approved_by and approved_at
ALTER TABLE public.profiles
ADD COLUMN approved_by UUID REFERENCES auth.users(id),
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rejection_reason TEXT,
ADD COLUMN task_target INTEGER DEFAULT 0;

-- Create farm_zones table for GPS geofencing
CREATE TABLE public.farm_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  gps_coordinates JSONB NOT NULL,
  supervisor_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  active BOOLEAN DEFAULT true
);

ALTER TABLE public.farm_zones ENABLE ROW LEVEL SECURITY;

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  target_roles TEXT[] DEFAULT ARRAY['all'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for farm_zones
CREATE POLICY "Everyone can view active zones"
ON public.farm_zones FOR SELECT
TO authenticated
USING (active = true);

CREATE POLICY "Admins can manage zones"
ON public.farm_zones FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for announcements
CREATE POLICY "Users can view announcements"
ON public.announcements FOR SELECT
TO authenticated
USING (
  'all' = ANY(target_roles) OR
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role::text = ANY(target_roles)
  )
);

CREATE POLICY "Admins can manage announcements"
ON public.announcements FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update profiles RLS to check approval status
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Approved users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND approval_status = 'approved');

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profiles for approval"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Function to log profile approval
CREATE OR REPLACE FUNCTION public.log_profile_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      auth.uid(),
      'Profile approval status changed',
      'profile',
      NEW.user_id,
      jsonb_build_object('status', OLD.approval_status),
      jsonb_build_object('status', NEW.approval_status, 'approved_by', NEW.approved_by)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profile_approval_audit
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_approval();