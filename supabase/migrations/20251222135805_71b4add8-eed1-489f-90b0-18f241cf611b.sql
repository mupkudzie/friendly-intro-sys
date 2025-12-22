-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update the handle_new_user function to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, role, email, contact_number, department, student_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'New User'),
        COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'student'),
        NEW.email,
        NEW.raw_user_meta_data ->> 'contact_number',
        NEW.raw_user_meta_data ->> 'department',
        NEW.raw_user_meta_data ->> 'student_id'
    );
    RETURN NEW;
END;
$$;