-- Fix existing users who have roles in user_roles but are still pending in profiles
UPDATE public.profiles p
SET approval_status = 'approved',
    approved_at = now()
WHERE approval_status = 'pending'
AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id
);