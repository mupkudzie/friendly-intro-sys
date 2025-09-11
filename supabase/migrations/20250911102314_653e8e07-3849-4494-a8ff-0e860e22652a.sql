-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'approved', 'rejected');

-- Create task priority enum
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    student_id TEXT,
    department TEXT,
    contact_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    assigned_by UUID NOT NULL REFERENCES public.profiles(user_id),
    assigned_to UUID NOT NULL REFERENCES public.profiles(user_id),
    status task_status NOT NULL DEFAULT 'pending',
    priority task_priority NOT NULL DEFAULT 'medium',
    due_date DATE,
    estimated_hours DECIMAL(4,2),
    location TEXT,
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create time logs table
CREATE TABLE public.time_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    total_hours DECIMAL(4,2),
    break_time DECIMAL(4,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task reports table
CREATE TABLE public.task_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    original_report TEXT NOT NULL,
    refined_report TEXT,
    ai_feedback TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    approved_by UUID REFERENCES public.profiles(user_id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task requests table
CREATE TABLE public.task_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requested_by UUID NOT NULL REFERENCES public.profiles(user_id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    justification TEXT,
    priority task_priority NOT NULL DEFAULT 'medium',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES public.profiles(user_id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_requests ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = user_uuid;
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tasks RLS policies
CREATE POLICY "Users can view their assigned tasks or tasks they created" ON public.tasks
    FOR SELECT USING (
        auth.uid() = assigned_to OR 
        auth.uid() = assigned_by OR 
        public.get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

CREATE POLICY "Supervisors and admins can create tasks" ON public.tasks
    FOR INSERT WITH CHECK (
        public.get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

CREATE POLICY "Supervisors and admins can update tasks" ON public.tasks
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('admin', 'supervisor') OR
        (auth.uid() = assigned_to AND status IN ('pending', 'in_progress'))
    );

-- Time logs RLS policies
CREATE POLICY "Users can view their own time logs" ON public.time_logs
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

CREATE POLICY "Users can create their own time logs" ON public.time_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time logs" ON public.time_logs
    FOR UPDATE USING (auth.uid() = user_id);

-- Task reports RLS policies
CREATE POLICY "Users can view task reports for their tasks" ON public.task_reports
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

CREATE POLICY "Users can create reports for their tasks" ON public.task_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Supervisors and admins can update reports" ON public.task_reports
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('admin', 'supervisor') OR
        auth.uid() = user_id
    );

-- Task requests RLS policies
CREATE POLICY "Users can view their own requests and supervisors can view all" ON public.task_requests
    FOR SELECT USING (
        auth.uid() = requested_by OR 
        public.get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

CREATE POLICY "Users can create task requests" ON public.task_requests
    FOR INSERT WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Supervisors and admins can update requests" ON public.task_requests
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_logs_updated_at
    BEFORE UPDATE ON public.time_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_reports_updated_at
    BEFORE UPDATE ON public.task_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_requests_updated_at
    BEFORE UPDATE ON public.task_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'New User'),
        COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'student')
    );
    RETURN NEW;
END;
$$;

-- Create trigger for new user profile creation
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();